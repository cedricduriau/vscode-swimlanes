// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';

// Debug logging utility
function debugLog(message: string, ...args: any[]) {
	const config = vscode.workspace.getConfiguration('swimlanes');
	if (config.get('debug.enableConsoleOutput', false)) {
		console.log(`[Swimlanes]`, message, ...args);
	}
}

function debugError(message: string, ...args: any[]) {
	const config = vscode.workspace.getConfiguration('swimlanes');
	if (config.get('debug.enableConsoleOutput', false)) {
		console.error(`[Swimlanes Error]`, message, ...args);
	}
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	debugLog('Swimlanes.io extension is now active!');

	// Show a more prominent message to confirm the extension loaded
	vscode.window.showInformationMessage('🏊‍♀️ Swimlanes extension activated! Ready to create diagrams!');

	// Also show in status bar
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(waves) Swimlanes";
	statusBarItem.tooltip = "Swimlanes extension is active";
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('swimlanes.createDiagram', () => {
			vscode.window.showInformationMessage('Create diagram command triggered!');
			createNewSwimlanesDiagram();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('swimlanes.preview', () => {
			vscode.window.showInformationMessage('Preview command triggered!');
			debugLog('Preview command executed');

			try {
				SwimlanesPreviewPanel.createOrShow(context.extensionUri);
				vscode.window.showInformationMessage('Preview panel created successfully');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Error creating preview: ${errorMessage}`);
				debugError('Preview creation error:', error);
			}
		})
	);

	// Register the preview panel provider
	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer(SwimlanesPreviewPanel.viewType, new SwimlanesPreviewSerializer())
	);
}

/**
 * Create a new swimlanes diagram with sample content
 */
async function createNewSwimlanesDiagram() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.window.showErrorMessage('Creating new swimlanes diagram requires an open workspace.');
		return;
	}

	const fileName = await vscode.window.showInputBox({
		prompt: 'Enter the name for your swimlanes diagram',
		value: 'my-sequence'
	});

	if (!fileName) {
		return;
	}

	const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, `${fileName}.swimlanes`);
	const sampleContent = `title: Sample Sequence Diagram

User -> Server: Login request
Server -> Database: Validate credentials
Database -> Server: User data
Server -> User: Login response

note: This is a basic sequence diagram using swimlanes.io syntax

if: User authenticated
  User -> Server: Get dashboard
  Server -> User: Dashboard data
else: Authentication failed
  Server -> User: Error message
end

User -> Server: Logout
Server -> User: Logged out

_: **End of sequence**`;

	const writeData = Buffer.from(sampleContent, 'utf8');
	await vscode.workspace.fs.writeFile(uri, writeData);

	// Open the file in the editor
	const doc = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(doc, { preview: false });
}

/**
 * Manages swimlanes preview webview panels
 */
class SwimlanesPreviewPanel {
	/**
	 * Track the currently active panels. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: SwimlanesPreviewPanel | undefined;

	public static readonly viewType = 'swimlanesPreview';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _currentContent: string = '';
	private _updateTimeout: NodeJS.Timeout | undefined;

	public static createOrShow(extensionUri: vscode.Uri) {
		debugLog('createOrShow called');
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		debugLog('Active column:', column);

		// Capture current content before creating/showing panel
		const activeEditor = vscode.window.activeTextEditor;
		let currentContent = '';
		if (activeEditor && (activeEditor.document.languageId === 'swimlanes' || activeEditor.document.fileName.endsWith('.swimlanes'))) {
			currentContent = activeEditor.document.getText();
			debugLog('Captured current content, length:', currentContent.length);
		}

		// If we already have a panel, show it.
		if (SwimlanesPreviewPanel.currentPanel) {
			debugLog('Existing panel found, revealing');
			SwimlanesPreviewPanel.currentPanel._panel.reveal(column);
			if (currentContent) {
				SwimlanesPreviewPanel.currentPanel._currentContent = currentContent;
			}
			SwimlanesPreviewPanel.currentPanel._update();
			return;
		}

		debugLog('Creating new panel');
		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			SwimlanesPreviewPanel.viewType,
			'Swimlanes Preview',
			column || vscode.ViewColumn.Beside,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// Allow external resources for swimlanes.io CDN
				localResourceRoots: [extensionUri],

				// Allow external resources from swimlanes.io CDN
				enableCommandUris: true,

				// Configure Content Security Policy to allow swimlanes.io
				retainContextWhenHidden: true
			}
		);

		// Set the panel icon
		panel.iconPath = {
			light: vscode.Uri.joinPath(extensionUri, 'images', 'icon-24.png'),
			dark: vscode.Uri.joinPath(extensionUri, 'images', 'icon-24.png')
		};

		debugLog('Panel created, initializing SwimlanesPreviewPanel');
		SwimlanesPreviewPanel.currentPanel = new SwimlanesPreviewPanel(panel, extensionUri, currentContent);
		debugLog('SwimlanesPreviewPanel initialized');
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		SwimlanesPreviewPanel.currentPanel = new SwimlanesPreviewPanel(panel, extensionUri, '');
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, initialContent: string = '') {
		debugLog('SwimlanesPreviewPanel constructor called with content length:', initialContent.length);
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._currentContent = initialContent;

		// Set the webview's initial html content
		debugLog('Setting initial HTML content');
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Listen for changes in the active text editor
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (this._panel.visible && editor && (editor.document.languageId === 'swimlanes' || editor.document.fileName.endsWith('.swimlanes'))) {
				debugLog('Updating preview due to swimlanes editor change');
				this._currentContent = editor.document.getText();
				this._update();
			}
		}, null, this._disposables);

		// Listen for changes in text documents
		vscode.workspace.onDidChangeTextDocument(e => {
			const config = vscode.workspace.getConfiguration('swimlanes');
			const autoRefresh = config.get('preview.autoRefresh', true);

			if (autoRefresh && this._panel.visible &&
				vscode.window.activeTextEditor &&
				e.document === vscode.window.activeTextEditor.document &&
				e.document.languageId === 'swimlanes') {
				debugLog('Auto-refreshing preview due to document change');
				this._currentContent = e.document.getText();
				this._update();
			}
		}, null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
		debugLog('SwimlanesPreviewPanel constructor complete');
	}

	public dispose() {
		SwimlanesPreviewPanel.currentPanel = undefined;

		// Clear any pending update timeout
		if (this._updateTimeout) {
			clearTimeout(this._updateTimeout);
			this._updateTimeout = undefined;
		}

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		// Clear any pending update
		if (this._updateTimeout) {
			clearTimeout(this._updateTimeout);
		}

		// Debounce updates to prevent rapid successive calls
		this._updateTimeout = setTimeout(() => {
			this._doUpdate();
		}, 50); // 50ms debounce
	}

	private _doUpdate() {
		debugLog('_doUpdate executing at:', new Date().toISOString());
		const webview = this._panel.webview;

		this._panel.title = 'Swimlanes Preview';

		try {
			// Generate HTML with the current content directly embedded
			const html = this.createSwimlanesHtml();

			debugLog('HTML generated successfully, length:', html.length);

			// Optionally dump HTML to file for debugging (controlled by setting)
			const config = vscode.workspace.getConfiguration('swimlanes');
			if (config.get('debug.dumpHtml', false)) {
				this.dumpHtmlToFile(html);
			}

			// Set the HTML using the proper webview method
			this._panel.webview.html = html;
			debugLog('HTML set to webview successfully');

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			debugError('Error generating HTML:', errorMessage);
			vscode.window.showErrorMessage(`Error generating preview HTML: ${errorMessage}`);
			// Set a fallback HTML
			this._panel.webview.html = `<html>
<body style="color: white; background: #1e1e1e; font-family: sans-serif; padding: 20px;">
<h1>Preview Error</h1>
<p>Failed to generate preview: ${errorMessage}</p>
</body>
</html>`;
		}
	}

	private dumpHtmlToFile(html: string) {
		try {
			const fs = require('fs');
			const path = require('path');
			const os = require('os');

			// Create a timestamp for the filename
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const fileName = `swimlanes-webview-${timestamp}.html`;
			const filePath = path.join(os.tmpdir(), fileName);

			// Write the HTML to the temporary file
			fs.writeFileSync(filePath, html, 'utf8');

			debugLog('🗂️  HTML dumped to:', filePath);
			debugLog('📋 You can open this file in a browser to inspect the generated HTML');

			// Also show a VS Code notification with the file path
			vscode.window.showInformationMessage(
				`HTML dumped to: ${filePath}`,
				'Open File'
			).then(selection => {
				if (selection === 'Open File') {
					vscode.window.showTextDocument(vscode.Uri.file(filePath));
				}
			});

		} catch (error) {
			console.error('Error dumping HTML to file:', error);
		}
	}

	private createSwimlanesHtml(): string {
		// Get the current swimlanes content
		let swimlanesContent = this._currentContent;
		const activeEditor = vscode.window.activeTextEditor;

		// If no stored content, try to get from active editor
		if (!swimlanesContent && activeEditor) {
			const fileName = activeEditor.document.fileName;
			const languageId = activeEditor.document.languageId;

			if (languageId === 'swimlanes' || fileName.endsWith('.swimlanes')) {
				swimlanesContent = activeEditor.document.getText();
				this._currentContent = swimlanesContent;
				debugLog('Got content from active editor, length:', swimlanesContent.length);
			}
		}

		// Fallback content if nothing found
		if (!swimlanesContent || swimlanesContent.trim() === '') {
			swimlanesContent = `title: No Content Found

note: Please open a .swimlanes file to see the preview`;
		}

		// Create the exact structure that swimlanes.io expects with content directly embedded
		// Use a very permissive CSP to allow swimlanes.io to work properly
		return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; frame-src *; connect-src *; font-src *; img-src * data: blob:;">
</head>
<body>
<script src="https://cdn.swimlanes.io/embed.js"></script>
<swimlanes-io>
${swimlanesContent}
</swimlanes-io>
</body>
</html>`;
	}
}

class SwimlanesPreviewSerializer implements vscode.WebviewPanelSerializer {
	async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
		SwimlanesPreviewPanel.revive(webviewPanel, vscode.Uri.file(state.extensionPath));
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }