import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { USER_ROLES } from '../constants';
import logger from '../utils/logger';
import { GoogleGenAI, Type } from '@google/genai';
import prisma from '../services/database';

const router = Router();

// Multer for in-memory file handling, 25MB cap
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Shared schema for Gemini JSON extraction
const responseSchema = {
  type: 'object',
  required: ['vendor', 'invoiceDate', 'lineItems'],
  additionalProperties: true, // Allow additional fields
  properties: {
    vendor: { type: 'string' },
    invoiceNumber: { type: 'string' },
    invoiceDate: { type: 'string', format: 'date-time' },
    currency: { type: 'string' },
    warrantyDefaultMonths: { type: 'integer', minimum: 0 },
    notes: { type: 'array', items: { type: 'string' } },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description', 'quantity', 'serviceTags'],
        additionalProperties: true, // Allow additional fields
        properties: {
          description: { type: 'string' },
          make: { type: 'string' },
          model: { type: 'string' },
          skuOrMTM: { type: 'string' },
          assetType: { type: 'string', enum: ['LAPTOP','DESKTOP','TABLET','PHONE','SERVER','OTHER'] },
          quantity: { type: 'integer', minimum: 1 },
          unitPrice: { type: 'number' },
          serviceTags: { type: 'array', items: { type: 'string' } },
          warrantyMonths: { type: 'integer', minimum: 0 },
          specs: {
            type: 'object',
            additionalProperties: true,
            properties: {
              cpu: { type: 'string' },
              ramGB: { type: 'number' },
              storage: { type: 'string' },
              gpu: { type: 'string' },
              screen: { type: 'string' },
              os: { type: 'string' },
              other: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

function addMonths(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Convert extraction to importer rows (one row per service tag)
function normalizeToRows(payload: any) {
  const invoiceDate = new Date(payload.invoiceDate);
  const defaultMonths = Number(payload.warrantyDefaultMonths || 0);

  const rows: Record<string, string>[] = [];
  const issues: Array<{ lineIndex: number; message: string }> = [];

  (payload.lineItems || []).forEach((li: any, idx: number) => {
    const qty = Number(li.quantity || 0);
    const tags: string[] = Array.isArray(li.serviceTags) ? li.serviceTags : [];
    
    // Skip accessories that don't require service tags
    const description = (li.description || '').toLowerCase();
    const isAccessory = description.includes('mouse') || description.includes('keyboard') || 
                       description.includes('cable') || description.includes('adapter') || 
                       description.includes('power cord') || description.includes('cord') ||
                       description.includes('charger') || description.includes('dongle');
    
    if (isAccessory && tags.length === 0) {
      // Skip accessories without service tags - this is expected
      return;
    }
    
    if (qty !== tags.length) {
      issues.push({ lineIndex: idx, message: `Quantity (${qty}) does not match number of service tags (${tags.length}) for line "${li.description || li.model || ''}"` });
    }

    const months = Number(li.warrantyMonths ?? defaultMonths ?? 0);
    const start = isNaN(invoiceDate.getTime()) ? null : invoiceDate;
    const end = start && months > 0 ? addMonths(start, months) : null;

    for (const tag of tags) {
      const row: Record<string, string> = {};
      row['Serial Number'] = String(tag);
      // Ensure make is properly set from LLM extraction
      if (li.make) {
        row['Make'] = String(li.make);
      } else if (payload.vendor) {
        // Fallback to vendor if make is not specified
        row['Make'] = String(payload.vendor);
      }
      if (li.model) row['Model'] = String(li.model);
      // Sensible defaults
      row['Asset Type'] = String(li.assetType || 'LAPTOP');
      // Purchase & warranty
      if (start) row['Purchase date'] = start.toISOString();
      if (start) row['Warranty Start Date'] = start.toISOString();
      if (end) row['Warranty End Date'] = end.toISOString();
      if (payload.vendor) row['Vendor'] = String(payload.vendor);
      
      // Calculate total purchase price (for Lenovo: unit price + support costs)
      let unitPrice = Number(li.unitPrice || 0);
      if (payload.vendor?.toLowerCase().includes('lenovo') && unitPrice > 0) {
        // For Lenovo, find support costs and add proportionally
        const supportItems = (payload.lineItems || []).filter((item: any) => 
          (item.description || '').toLowerCase().includes('support') ||
          (item.description || '').toLowerCase().includes('upgrade') ||
          (item.description || '').toLowerCase().includes('premier')
        );
        const totalSupportCost = supportItems.reduce((sum: number, item: any) => 
          sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1)), 0
        );
        if (totalSupportCost > 0) {
          unitPrice += totalSupportCost / qty; // Distribute support cost across main items
        }
      }
      if (unitPrice > 0) row['Unit price'] = String(unitPrice);
      if (payload.invoiceNumber) row['Invoice Number'] = String(payload.invoiceNumber);
      // Specs
      if (li.specs?.cpu) row['cpu'] = String(li.specs.cpu);
      if (li.specs?.ramGB) row['ram'] = String(li.specs.ramGB);
      if (li.specs?.storage) row['storage'] = String(li.specs.storage);
      if (li.specs?.gpu) row['gpu'] = String(li.specs.gpu);
      if (li.specs?.os) row['operatingSystem'] = String(li.specs.os);
      rows.push(row);
    }
  });

  return { rows, issues };
}

// POST /api/invoice/extract-stream - SSE endpoint for real-time LLM output
router.post(
  '/extract-stream',
  authenticateJwt,
  requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]),
  upload.single('file'),
  async (req: Request, res: Response) => {
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    res.flushHeaders();

    const sendSSE = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const file = req.file;
      if (!file) {
        sendSSE('error', { error: 'No file uploaded' });
        return res.end();
      }

      const apiKey = process.env.GEMINI_API_KEY;
      logger.info(`GEMINI_API_KEY loaded: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);
      if (!apiKey) {
        sendSSE('error', { error: 'GEMINI_API_KEY not configured' });
        return res.end();
      }

      sendSSE('status', { message: 'Initializing AI model...' });
      const ai = new GoogleGenAI({ apiKey });
      
      sendSSE('status', { message: 'Processing document...' });
      const mimeType = file.mimetype || 'application/pdf';
      const dataPart = { inlineData: { data: file.buffer.toString('base64'), mimeType } } as any;

      const prompt = [
        'Extract comprehensive invoice details for IT hardware assets. Be thorough and detailed.',
        '',
        'CRITICAL SERVICE TAG EXTRACTION:',
        '• For Lenovo: Look for "Serial #" followed by space-separated codes like "PF5QVV58 PF5QBQ1Q"',
        '• For Dell: Look for "System Service Tag/No de serie:" followed by comma-separated codes like "9B9BL84, 8B9BL84"',
        '• Service tags are ALPHANUMERIC codes (mix of letters and numbers), typically 6-10 characters long',
        '• Extract ALL service tags/serial numbers - they are the most important data',
        '',
        'REQUIRED FIELDS TO EXTRACT:',
        '• vendor: Company name (Dell, Lenovo, etc.)',
        '• currency: Currency code (CAD, USD, etc.)',
        '• invoiceNumber: Invoice number from document',
        '• invoiceDate: Invoice date in ISO format',
        '',
        'FOR EACH HARDWARE LINE ITEM, EXTRACT:',
        '• description: Full item description',
        '• make: Manufacturer name (Dell, Lenovo, etc.)',
        '• model: Specific model name/number',
        '• assetType: Choose from LAPTOP, DESKTOP, TABLET, PHONE, SERVER, OTHER',
        '• skuOrMTM: SKU, MTM, or part number if available',
        '• quantity: Number of items',
        '• unitPrice: Price per unit',
        '• serviceTags: Array of all service tags for this item',
        '• warrantyMonths: Warranty period (3Y=36, 1Y=12, etc.)',
        '• specs: Detailed specifications object with cpu, ramGB, storage, gpu, os, screen, other',
        '',
        'HARDWARE SPECIFICATIONS TO EXTRACT:',
        '• cpu: Processor details (Intel Core i7, AMD Ryzen, etc.)',
        '• ramGB: Memory amount in GB (convert "32GB" to number 32)',
        '• storage: Storage details (1TB SSD, 512GB NVMe, etc.)',
        '• gpu: Graphics card (NVIDIA RTX 4060, Intel UHD, etc.)',
        '• os: Operating system (Windows 11 Pro, etc.)',
        '• screen: Display specifications if mentioned',
        '• other: Any other relevant specs (wireless, ports, cooling, etc.)',
        '',
        'FILTERING RULES:',
        '• IGNORE accessories like mouse, keyboard, cables, adapters, power cords - they do NOT have service tags',
        '• IGNORE pure support/warranty/service lines without hardware',
        '• Only extract actual hardware assets that would have unique service tags',
        '',
        'Be comprehensive and extract ALL available details from the invoice.',
      ].join('\n');

      sendSSE('status', { message: 'Extracting with Gemini AI...' });
      
      let fullText = '';
      let thoughts = '';
      try {
        // Use proper streaming with thinking support
        const response = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [dataPart, { text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema as any,
            maxOutputTokens: 8192,
            temperature: 0.1,
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: 2048, // Allow reasonable thinking budget
            },
          },
        });

        sendSSE('status', { message: 'Processing with AI (thinking)...' });

        // Stream chunks with proper thinking support
        for await (const chunk of response) {
          if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (!part.text) continue;
              
              if (part.thought) {
                // This is thinking content
                thoughts += part.text;
                sendSSE('thinking', { text: part.text, thoughts: thoughts });
              } else {
                // This is the actual response
                fullText += part.text;
                sendSSE('chunk', { text: part.text, partial: fullText });
              }
            }
          }
          
          // Add small delay for better streaming experience
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (apiErr: any) {
        logger.error({ err: apiErr?.message || apiErr }, 'Gemini generateContent failed');
        sendSSE('error', { error: 'LLM extraction failed', details: apiErr?.message });
        return res.end();
      }

      if (!fullText) {
        sendSSE('error', { error: 'No extraction output from model' });
        return res.end();
      }

      sendSSE('status', { message: 'Parsing results...' });
      
      let payload: any;
      try {
        // Clean the text - remove any non-JSON content
        let cleanText = fullText.trim();
        
        // Find JSON boundaries if mixed with other content
        const jsonStart = cleanText.indexOf('{');
        const jsonEnd = cleanText.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
        }
        
        payload = JSON.parse(cleanText);
        logger.info({ payloadKeys: Object.keys(payload) }, 'Successfully parsed JSON payload');
      } catch (parseErr) {
        logger.error({ text: fullText, error: parseErr }, 'Failed to parse extraction JSON');
        sendSSE('error', { 
          error: 'Failed to parse extraction JSON', 
          raw: fullText,
          details: `Parse error: ${parseErr}. Raw text length: ${fullText.length}` 
        });
        return res.end();
      }

      sendSSE('llm_output', { raw: payload });
      
      const { rows, issues } = normalizeToRows(payload);
      if (issues.length > 0) {
        sendSSE('error', { error: 'Quantity mismatch', issues, raw: payload });
        return res.end();
      }

      sendSSE('status', { message: 'Saving document...' });
      
      // Persist the uploaded file
      const baseDir = path.join(process.cwd(), 'uploads', 'invoices');
      const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
      const dir = path.join(baseDir, fileId);
      fs.mkdirSync(dir, { recursive: true });
      const safeName = file.originalname || `invoice.${mimeType.split('/')[1] || 'pdf'}`;
      const storagePath = path.join(dir, safeName);
      fs.writeFileSync(storagePath, file.buffer);

      // Create Document record
      const uploaderId = (req as any).user?.userId as string | undefined;
      let documentId: string | null = null;
      try {
        const document = await prisma.document.create({
          data: {
            fileName: safeName,
            fileType: mimeType,
            fileSize: file.size,
            storagePath,
            isAdminOnly: true,
            uploadedById: uploaderId || 'unknown',
          },
        });
        documentId = document.id;
      } catch (e) {
        logger.warn('Failed to persist Document record; continuing without documentId', e);
      }

      const columnMappings = [
        { ninjaColumn: 'Serial Number', targetField: 'serialNumber', isRequired: true },
        { ninjaColumn: 'Make', targetField: 'make', isRequired: false },
        { ninjaColumn: 'Model', targetField: 'model', isRequired: false },
        { ninjaColumn: 'Asset Type', targetField: 'assetType', isRequired: false },
        { ninjaColumn: 'Purchase date', targetField: 'purchaseDate', isRequired: false },
        { ninjaColumn: 'Warranty Start Date', targetField: 'warrantyStartDate', isRequired: false },
        { ninjaColumn: 'Warranty End Date', targetField: 'warrantyEndDate', isRequired: false },
        { ninjaColumn: 'Unit price', targetField: 'purchasePrice', isRequired: false },
        { ninjaColumn: 'Invoice Number', targetField: 'invoiceNumber', isRequired: false },
        // Hardware specifications (stored in JSON specifications field)
        { ninjaColumn: 'cpu', targetField: 'cpu', isRequired: false },
        { ninjaColumn: 'ram', targetField: 'ram', isRequired: false },
        { ninjaColumn: 'storage', targetField: 'storage', isRequired: false },
        { ninjaColumn: 'gpu', targetField: 'gpu', isRequired: false },
        { ninjaColumn: 'operatingSystem', targetField: 'operatingSystem', isRequired: false },
        // Note: Vendor name is extracted but not mapped to vendorId (would need lookup/creation)
        // { ninjaColumn: 'Vendor', targetField: 'vendorId', isRequired: false },
      ];

      sendSSE('complete', {
        headers: Array.from(new Set(rows.flatMap(r => Object.keys(r)))),
        rows,
        columnMappings,
        raw: payload,
        documentId,
      });
      
      res.end();
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Invoice extraction failed');
      sendSSE('error', { error: 'Failed to extract invoice details' });
      res.end();
    }
  }
);

// POST /api/invoice/extract - Original non-streaming endpoint
router.post(
  '/extract',
  authenticateJwt,
  requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

      const ai = new GoogleGenAI({ apiKey });
      logger.info('Role check');
      logger.debug({ fileName: file.originalname, size: file.size, type: file.mimetype }, 'Invoice upload received');

      // Build parts array for inline file
      const mimeType = file.mimetype || 'application/pdf';
      const dataPart = { inlineData: { data: file.buffer.toString('base64'), mimeType } } as any;

      const prompt = [
        'Extract structured invoice details for IT hardware assets.',
        'CRITICAL: Service tags (also called Serial Numbers) are ALWAYS found in one of these locations:',
        '1. For Lenovo: Look for lines starting with "Serial #" followed by space-separated codes like "PF5QVV58 PF5QBQ1Q" etc.',
        '2. For Dell: Look for "System Service Tag/No de serie:" followed by comma-separated codes like "9B9BL84, 8B9BL84" etc.',
        '3. Service tags are ALPHANUMERIC codes (mix of letters and numbers), typically 6-10 characters long.',
        '4. Extract ALL service tags/serial numbers you find - they are the most important data.',
        '5. If you see a quantity (e.g., 6) but find 6 service tags, list all 6 tags in serviceTags array.',
        '6. Provide warrantyMonths if stated (e.g., 36 months, 3Y = 36 months, 2Y = 24 months).',
        '7. If multiple models exist, create separate lineItems with their own quantity and tags.',
        '8. IGNORE lines that are purely support/warranty/service without hardware (no service tags needed for those).',
        '9. CRITICAL: IGNORE accessories like mouse, keyboard, cables, adapters, power cords - they do NOT have service tags.',
        '10. Only extract items that are actual hardware assets (computers, monitors, phones, tablets) that would have unique service tags.',
      ].join(' ');

      let result;
      try {
        result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [dataPart, { text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema as any,
          },
        } as any);
      } catch (apiErr: any) {
        logger.error({ err: apiErr?.message || apiErr }, 'Gemini generateContent failed');
        return res.status(500).json({ error: 'LLM extraction failed' });
      }

      const text = (result as any)?.text || (result as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return res.status(502).json({ error: 'No extraction output from model' });

      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      if (!payload || typeof payload !== 'object') {
        return res.status(502).json({ error: 'Failed to parse extraction JSON' });
      }

      const { rows, issues } = normalizeToRows(payload);
      if (issues.length > 0) {
        return res.status(400).json({ error: 'Quantity mismatch', issues, raw: payload });
      }

      // Persist the uploaded file once to disk for future linking
      const baseDir = path.join(process.cwd(), 'uploads', 'invoices');
      const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
      const dir = path.join(baseDir, fileId);
      fs.mkdirSync(dir, { recursive: true });
      const safeName = file.originalname || `invoice.${mimeType.split('/')[1] || 'pdf'}`;
      const storagePath = path.join(dir, safeName);
      fs.writeFileSync(storagePath, file.buffer);

      // Create Document record (admin-only)
      const uploaderId = (req as any).user?.userId as string | undefined;
      let documentId: string | null = null;
      try {
        const document = await prisma.document.create({
          data: {
            fileName: safeName,
            fileType: mimeType,
            fileSize: file.size,
            storagePath,
            isAdminOnly: true,
            uploadedById: uploaderId || 'unknown',
          },
        });
        documentId = document.id;
      } catch (e) {
        logger.warn('Failed to persist Document record; continuing without documentId', e);
      }

      // Suggested minimal mappings so import works seamlessly
      const columnMappings = [
        { ninjaColumn: 'Serial Number', targetField: 'serialNumber', isRequired: true },
        { ninjaColumn: 'Make', targetField: 'make', isRequired: false },
        { ninjaColumn: 'Model', targetField: 'model', isRequired: false },
        { ninjaColumn: 'Asset Type', targetField: 'assetType', isRequired: false },
        { ninjaColumn: 'Purchase date', targetField: 'purchaseDate', isRequired: false },
        { ninjaColumn: 'Warranty Start Date', targetField: 'warrantyStartDate', isRequired: false },
        { ninjaColumn: 'Warranty End Date', targetField: 'warrantyEndDate', isRequired: false },
        { ninjaColumn: 'Unit price', targetField: 'purchasePrice', isRequired: false },
        { ninjaColumn: 'Invoice Number', targetField: 'invoiceNumber', isRequired: false },
        // Hardware specifications (stored in JSON specifications field)
        { ninjaColumn: 'cpu', targetField: 'cpu', isRequired: false },
        { ninjaColumn: 'ram', targetField: 'ram', isRequired: false },
        { ninjaColumn: 'storage', targetField: 'storage', isRequired: false },
        { ninjaColumn: 'gpu', targetField: 'gpu', isRequired: false },
        { ninjaColumn: 'operatingSystem', targetField: 'operatingSystem', isRequired: false },
        // Note: Vendor name is extracted but not mapped to vendorId (would need lookup/creation)
        // { ninjaColumn: 'Vendor', targetField: 'vendorId', isRequired: false },
      ];

      res.json({
        headers: Array.from(new Set(rows.flatMap(r => Object.keys(r)))),
        rows,
        columnMappings,
        raw: payload,
        file: {
          id: fileId,
          fileName: safeName,
          fileType: mimeType,
          fileSize: file.size,
          storagePath,
        },
        documentId,
      });
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Invoice extraction failed');
      res.status(500).json({ error: 'Failed to extract invoice details' });
    }
  }
);

// Admin-only file download
router.get('/file/:documentId', authenticateJwt, requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params as any;
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) return res.status(404).send('Not found');
    if (!fs.existsSync(doc.storagePath)) return res.status(404).send('Not found');
    res.setHeader('Content-Type', doc.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    res.sendFile(doc.storagePath);
  } catch (e) {
    res.status(500).send('Failed to fetch file');
  }
});

export default router;


