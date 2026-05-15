const vscode = require("vscode");
const { execFile } = require("child_process");
const os = require("os");
const path = require("path");

/** @returns {Promise<void>} */
const sudoWriteFile = async (/** @type {string} */filename, /** @type {string | Uint8Array} */content, /** @type {string} */user) => {
    const config = vscode.workspace.getConfiguration("sudo-remote-ssh");
    return new Promise((resolve, reject) => {
        const p = execFile(config.get("command", "sudo"), [...(user === "root" ? [] : ["-u", user]), "-S", "-p", "password:", `filename=${filename}`, "sh", "-c", 'echo "file contents:" >&2; cat <&0 > "$filename"']);
        
        p.on("error", (err) => { stopTimer(); reject(err); });
        const cancel = (/** @type {Error} */err) => { if (!p.killed) { p.kill(); } stopTimer(); reject(err); };

        let timer = null;
        const startTimer = () => { timer = setTimeout(() => { if (p.exitCode === null) { cancel(new Error(`Timeout: ${stderr}`)); } }, 60 * 1000); };
        const stopTimer = () => { if (timer !== null) { clearTimeout(timer); } timer = null; };
        startTimer();

        let stderr = "";
        p.stderr?.on("data", (/** @type {Buffer} */chunk) => {
            const lines = chunk.toString().split("\n").map((line) => line.trim());
            if (lines.includes("password:")) {
                stopTimer();
                vscode.window.showInputBox({ password: true, title: `Action as ${user}`, placeHolder: `password for ${os.userInfo().username}`, prompt: stderr !== "" ? `\n${stderr}` : "", ignoreFocusOut: true }).then((password) => {
                    if (password === undefined) { return cancel(new vscode.CancellationError()); }
                    startTimer(); p.stdin?.write(`${password}\n`);
                }, cancel);
                stderr = "";
            } else if (lines.includes("file contents:")) {
                p.stdin?.write(content); p.stdin?.end();
                stderr += lines.slice(lines.lastIndexOf("file contents:") + 1).join("\n");
            } else {
                stderr += chunk.toString();
            }
        });

        p.on("exit", (code) => { stopTimer(); if (code === 0) { return resolve(); } else { reject(new Error(`exit code ${code}: ${stderr}`)); } });
    });
};

/** @returns {Promise<void>} */
const sudoDeleteFileOrFolder = async (/** @type {string} */targetPath, /** @type {string} */user) => {
    const config = vscode.workspace.getConfiguration("sudo-remote-ssh");
    return new Promise((resolve, reject) => {
        // Changed to 'rm -rf' to support folder deletion
        const p = execFile(config.get("command", "sudo"), [...(user === "root" ? [] : ["-u", user]), "-S", "-p", "password:", "rm", "-rf", targetPath]);
        
        p.on("error", (err) => { stopTimer(); reject(err); });
        const cancel = (/** @type {Error} */err) => { if (!p.killed) { p.kill(); } stopTimer(); reject(err); };

        let timer = null;
        const startTimer = () => { timer = setTimeout(() => { if (p.exitCode === null) { cancel(new Error(`Timeout: ${stderr}`)); } }, 60 * 1000); };
        const stopTimer = () => { if (timer !== null) { clearTimeout(timer); } timer = null; };
        startTimer();

        let stderr = "";
        p.stderr?.on("data", (/** @type {Buffer} */chunk) => {
            const lines = chunk.toString().split("\n").map((line) => line.trim());
            if (lines.includes("password:")) {
                stopTimer();
                vscode.window.showInputBox({ password: true, title: `Delete as ${user}`, placeHolder: `password for ${os.userInfo().username}`, prompt: stderr !== "" ? `\n${stderr}` : "", ignoreFocusOut: true }).then((password) => {
                    if (password === undefined) { return cancel(new vscode.CancellationError()); }
                    startTimer(); p.stdin?.write(`${password}\n`); p.stdin?.end();
                }, cancel);
                stderr = "";
            } else {
                stderr += chunk.toString();
            }
        });

        p.on("exit", (code) => { stopTimer(); if (code === 0) { return resolve(); } else { reject(new Error(`exit code ${code}: ${stderr}`)); } });
    });
};

/** @returns {Promise<void>} */
const sudoCreateFolder = async (/** @type {string} */folderPath, /** @type {string} */user) => {
    const config = vscode.workspace.getConfiguration("sudo-remote-ssh");
    return new Promise((resolve, reject) => {
        // Run mkdir -p to create folder and parent folders if needed
        const p = execFile(config.get("command", "sudo"), [...(user === "root" ? [] : ["-u", user]), "-S", "-p", "password:", "mkdir", "-p", folderPath]);
        
        p.on("error", (err) => { stopTimer(); reject(err); });
        const cancel = (/** @type {Error} */err) => { if (!p.killed) { p.kill(); } stopTimer(); reject(err); };

        let timer = null;
        const startTimer = () => { timer = setTimeout(() => { if (p.exitCode === null) { cancel(new Error(`Timeout: ${stderr}`)); } }, 60 * 1000); };
        const stopTimer = () => { if (timer !== null) { clearTimeout(timer); } timer = null; };
        startTimer();

        let stderr = "";
        p.stderr?.on("data", (/** @type {Buffer} */chunk) => {
            const lines = chunk.toString().split("\n").map((line) => line.trim());
            if (lines.includes("password:")) {
                stopTimer();
                vscode.window.showInputBox({ password: true, title: `Create Folder as ${user}`, placeHolder: `password for ${os.userInfo().username}`, prompt: stderr !== "" ? `\n${stderr}` : "", ignoreFocusOut: true }).then((password) => {
                    if (password === undefined) { return cancel(new vscode.CancellationError()); }
                    startTimer(); p.stdin?.write(`${password}\n`); p.stdin?.end();
                }, cancel);
                stderr = "";
            } else {
                stderr += chunk.toString();
            }
        });

        p.on("exit", (code) => { stopTimer(); if (code === 0) { return resolve(); } else { reject(new Error(`exit code ${code}: ${stderr}`)); } });
    });
};

const notifyToOtherExtensions = async (/** @type {"willSave" | "didSave"} */eventName, /** @type {vscode.TextDocument} */document) => {
    for (const extensionId of vscode.workspace.getConfiguration("sudo-remote-ssh").get("extensionsToNotifyOnSave", /** @type {string[]} */([]))) {
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension === undefined) continue;
        if (!extension.isActive) { await extension.activate(); }
        const exports = extension.exports;
        switch (eventName) {
            case "willSave":
                if (typeof exports.onWillSaveDocument === "function") { await exports.onWillSaveDocument(document, vscode.TextDocumentSaveReason.Manual); }
                break;
            case "didSave":
                if (typeof exports.onDocumentSaved === "function") { await exports.onDocumentSaved(document); }
                break;
        }
    }
};

// Handlers for commands to make reusing logic easier
const handleNewFile = async (uri, user) => {
    let encodingOptions;
    if (uri === undefined && vscode.window.activeTextEditor !== undefined) {
        uri = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)?.uri;
        encodingOptions = { encoding: vscode.window.activeTextEditor.document.encoding };
    }
    if (uri === undefined && vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders.length > 0) {
        uri = vscode.workspace.workspaceFolders[0].uri;
    }
    if (uri === undefined) { uri = vscode.Uri.parse(os.homedir()); }
    if (uri.scheme !== "file") { await vscode.window.showErrorMessage(`[Sudo Remote - SSH] Unsupported uri scheme: ${uri.scheme}`); return; }

    const pathValue = uri.fsPath + path.sep;
    const filepath = await vscode.window.showInputBox({ value: pathValue, valueSelection: [pathValue.length, pathValue.length], prompt: `Enter file path to create as ${user}` });
    if (!filepath || filepath.endsWith(path.sep)) return;
    
    uri = vscode.Uri.parse(filepath);
    const emptyString = encodingOptions === undefined ? await vscode.workspace.encode("") : await vscode.workspace.encode("", encodingOptions);
    await sudoWriteFile(filepath, emptyString, user);
    await vscode.commands.executeCommand("vscode.open", uri);
    vscode.window.showInformationMessage(`[Sudo Remote - SSH] Successfully added file: ${filepath}`);
};

const handleNewFolder = async (uri, user) => {
    if (uri === undefined && vscode.window.activeTextEditor !== undefined) {
        uri = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)?.uri;
    }
    if (uri === undefined && vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders.length > 0) {
        uri = vscode.workspace.workspaceFolders[0].uri;
    }
    if (uri === undefined) { uri = vscode.Uri.parse(os.homedir()); }
    if (uri.scheme !== "file") { await vscode.window.showErrorMessage(`[Sudo Remote - SSH] Unsupported uri scheme: ${uri.scheme}`); return; }

    const pathValue = uri.fsPath + path.sep;
    const folderpath = await vscode.window.showInputBox({ value: pathValue, valueSelection: [pathValue.length, pathValue.length], prompt: `Enter folder path to create as ${user}` });
    if (!folderpath) return;
    
    await sudoCreateFolder(folderpath, user);
    vscode.window.showInformationMessage(`[Sudo Remote - SSH] Successfully added folder: ${folderpath}`);
};

exports.activate = (/** @type {vscode.ExtensionContext} */context) => {
    
    // Command 1: Save as Root
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.saveFile", async (/** @type {string | undefined} */user = "root") => {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) return;
        
        if (!["file", "untitled"].includes(editor.document.uri.scheme)) {
            vscode.commands.executeCommand("workbench.action.files.save");
            return;
        }

        try {
            if (!editor.document.isUntitled) {  
                await notifyToOtherExtensions("willSave", editor.document);
                await sudoWriteFile(editor.document.fileName, await vscode.workspace.encode(editor.document.getText(), { encoding: editor.document.encoding }), user);
                if (vscode.window.activeTextEditor !== editor) {
                    await vscode.window.showTextDocument(editor.document, editor.viewColumn);
                }
                await vscode.commands.executeCommand("workbench.action.files.revert");
                await notifyToOtherExtensions("didSave", editor.document);
            } else { 
                let filename;
                if (editor.document.fileName.startsWith("/")) {
                    filename = editor.document.fileName;
                } else {
                    const input = await vscode.window.showSaveDialog({});
                    if (input === undefined) return;
                    filename = input.fsPath;
                }

                await sudoWriteFile(filename, "", user);
                const newDocument = await vscode.workspace.openTextDocument(filename, { encoding: editor.document.encoding });
                await notifyToOtherExtensions("willSave", newDocument);
                await sudoWriteFile(filename, await vscode.workspace.encode(editor.document.getText(), { encoding: editor.document.encoding }), user);
                const column = editor.viewColumn;

                if (vscode.window.activeTextEditor !== editor) {
                    await vscode.window.showTextDocument(editor.document, editor.viewColumn);
                }

                await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
                await vscode.window.showTextDocument(newDocument, column);
                await vscode.commands.executeCommand("workbench.action.files.revert");
                await notifyToOtherExtensions("didSave", newDocument);
            }
            vscode.window.showInformationMessage(`[Sudo Remote - SSH] Successfully saved`);
        } catch (err) {
            if (err instanceof vscode.CancellationError) return;
            vscode.window.showErrorMessage(`[Sudo Remote - SSH] ${err.message}`);
        }
    }));

    // Command 2: Save as Specified User
    let lastUser = "";
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.saveFileAsSpecifiedUser", async () => {
        const user = lastUser = await vscode.window.showInputBox({ value: lastUser, placeHolder: "username", ignoreFocusOut: true }) || "";
        if (!user) { await vscode.window.showInformationMessage("[Sudo Remote - SSH] Canceled!"); return; }
        vscode.commands.executeCommand("sudo-remote-ssh.saveFile", user);
    }));

    // Command 3: New File as Root
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.newFile", async (uri) => {
        try { await handleNewFile(uri, "root"); } catch (err) { vscode.window.showErrorMessage(`[Sudo Remote - SSH] ${err.message}`); }
    }));

    // Command 4: New File as Specified User
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.newFileAsSpecifiedUser", async (uri) => {
        try {
            const user = lastUser = await vscode.window.showInputBox({ value: lastUser, placeHolder: "username", ignoreFocusOut: true }) || "";
            if (!user) return;
            await handleNewFile(uri, user);
        } catch (err) { vscode.window.showErrorMessage(`[Sudo Remote - SSH] ${err.message}`); }
    }));

    // Command 5: New Folder as Root
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.newFolder", async (uri) => {
        try { await handleNewFolder(uri, "root"); } catch (err) { vscode.window.showErrorMessage(`[Sudo Remote - SSH] ${err.message}`); }
    }));

    // Command 6: New Folder as Specified User
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.newFolderAsSpecifiedUser", async (uri) => {
        try {
            const user = lastUser = await vscode.window.showInputBox({ value: lastUser, placeHolder: "username", ignoreFocusOut: true }) || "";
            if (!user) return;
            await handleNewFolder(uri, user);
        } catch (err) { vscode.window.showErrorMessage(`[Sudo Remote - SSH] ${err.message}`); }
    }));

    // Command 7: Delete File or Folder as Root
    context.subscriptions.push(vscode.commands.registerCommand("sudo-remote-ssh.deleteFileOrFolder", async (/** @type {vscode.Uri | undefined} */uri) => {
        try {
            if (uri === undefined && vscode.window.activeTextEditor !== undefined) { uri = vscode.window.activeTextEditor.document.uri; }
            if (uri === undefined || uri.scheme !== "file") {
                await vscode.window.showErrorMessage("[Sudo Remote - SSH] No file or folder selected to delete."); return;
            }

            const targetPath = uri.fsPath;
            const confirm = await vscode.window.showWarningMessage(`[Sudo Remote - SSH] Are you sure you want to permanently delete '${targetPath}' as root?`, { modal: true }, "Delete");
            if (confirm !== "Delete") return; 

            await sudoDeleteFileOrFolder(targetPath, "root");

            // Close the file (or any files inside the folder) if they are currently open
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document.uri.fsPath === targetPath || editor.document.uri.fsPath.startsWith(targetPath + path.sep)) {
                    await vscode.window.showTextDocument(editor.document);
                    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                }
            }

            vscode.window.showInformationMessage(`[Sudo Remote - SSH] Successfully deleted: ${targetPath}`);
        } catch (err) {
            if (err instanceof vscode.CancellationError) return;
            vscode.window.showErrorMessage(`[Sudo Remote - SSH] ${err.message}`);
        }
    }));
};

exports.deactivate = () => { };