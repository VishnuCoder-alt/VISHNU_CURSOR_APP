// server.js (fixed mkdir bug + AI tools + file editor + preview/download)
import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const asyncExecute = promisify(exec);
const platform = os.platform();
const History = [];

let lastCreatedFolder = '';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const baseWorkspace = path.join(__dirname, 'workspace');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/preview', express.static(baseWorkspace));
app.use(express.json());

// ---------- TOOLS ----------
async function executeCommand({ command }) {
  try {
    const { stdout, stderr } = await asyncExecute(command);

    if (command.startsWith("mkdir ")) {
      const parts = command.split(" ");
      const folder = parts.reverse().find(p => !p.startsWith("-") && p.trim() !== "");
      if (folder) {
        lastCreatedFolder = folder.replace(/[^a-zA-Z0-9-_]/g, '');
        console.log("📁 Created folder:", lastCreatedFolder);
      }
    }

    if (stderr) return `Error: ${stderr}`;
    return `✅ Command executed: ${command}\n${stdout || "Done"}`;
  } catch (error) {
    return `❌ Command failed: ${error.message}`;
  }
}

async function writeToFile({ path: userPath, content }) {
  try {
    const fullPath = path.join(baseWorkspace, userPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return `✅ Wrote content to ${userPath}`;
  } catch (err) {
    return `❌ Failed to write to ${userPath}: ${err.message}`;
  }
}

async function readFile({ path: userPath }) {
  try {
    const fullPath = path.join(baseWorkspace, userPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (err) {
    return `❌ Could not read ${userPath}: ${err.message}`;
  }
}

const executeCommandDeclaration = {
  name: "executeCommand",
  description: "Run shell/terminal command",
  parameters: {
    type: "OBJECT",
    properties: {
      command: { type: "STRING" },
    },
    required: ["command"],
  },
};

const writeToFileDeclaration = {
  name: "writeToFile",
  description: "Write content to a file",
  parameters: {
    type: "OBJECT",
    properties: {
      path: { type: "STRING" },
      content: { type: "STRING" },
    },
    required: ["path", "content"],
  },
};

const readFileDeclaration = {
  name: "readFile",
  description: "Read content from a file",
  parameters: {
    type: "OBJECT",
    properties: {
      path: { type: "STRING" },
    },
    required: ["path"],
  },
};

const availableTools = { executeCommand, writeToFile, readFile };

// ---------- MAIN AI ENDPOINT ----------
app.post('/runAgent', async (req, res) => {
  const userProblem = req.body.query;

  History.push({ role: 'user', parts: [{ text: userProblem }] });
  const allResults = [];

  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: History,
      config: {
        systemInstruction: `You are a web builder agent.
User is on ${platform}. Only use tools:
1. executeCommand - to create folders/files
2. writeToFile - to write HTML/CSS/JS
3. readFile - to read before updating nav/footer/etc
Always use 'readFile' before modifying existing code
Make sites UI-rich, animated, styled realistically.
use animation more in sites`,
        tools: [{
          functionDeclarations: [
            executeCommandDeclaration,
            writeToFileDeclaration,
            readFileDeclaration,
          ]
        }]
      }
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const { name, args } = response.functionCalls[0];
      console.log("🤖 Tool used:", name, args);

      const toolFunc = availableTools[name];
      const result = await toolFunc(args);

      History.push({ role: "model", parts: [{ functionCall: response.functionCalls[0] }] });
      History.push({ role: "user", parts: [{ functionResponse: { name, response: { result } } }] });

      allResults.push(`✅ ${name}: ${typeof result === 'string' ? result : JSON.stringify(result)}`);
    } else {
      if (response.text) {
        allResults.push(`📝 ${response.text}`);
      }
      break;
    }
  }

  // Validate the folder name (prevent -p or invalid)
  if (!lastCreatedFolder || !/^[a-zA-Z0-9-_]+$/.test(lastCreatedFolder)) {
    lastCreatedFolder = "";
  }

  res.json({
    type: "batch",
    result: allResults.join('\n'),
    folder: lastCreatedFolder,
  });
});

// ---------- FILE EDITING ENDPOINTS ----------
app.get('/edit/:folder/:file', async (req, res) => {
  const { folder, file } = req.params;
  const fullPath = path.join(baseWorkspace, folder, file);
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    res.send(`<textarea style='width:100%;height:90vh'>${content}</textarea>`);
  } catch {
    res.status(404).send("File not found");
  }
});

app.post('/save', async (req, res) => {
  const { filePath, content } = req.body;
  try {
    const fullPath = path.join(baseWorkspace, filePath);
    await fs.writeFile(fullPath, content);
    res.json({ status: "saved" });
  } catch {
    res.status(500).json({ error: "Failed to save" });
  }
});

// ---------- ZIP DOWNLOAD ----------
app.get('/download/:folder', (req, res) => {
  const folderName = req.params.folder;
  const folderPath = path.join(baseWorkspace, folderName);

  res.setHeader('Content-Disposition', `attachment; filename=${folderName}.zip`);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip');
  archive.pipe(res);
  archive.directory(folderPath, false);
  archive.finalize();
});

app.listen(port, () => {
  console.log(`🟢 Server running at http://localhost:${port}`);
});
