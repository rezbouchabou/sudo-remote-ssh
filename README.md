# Sudo for Remote - SSH 

Add, edit, save, delete, and change permissions/ownership of protected files and folders with sudo/root privileges while using the VS Code Remote - SSH extension.

If you frequently work on remote Linux servers and need to edit system configuration files (like `/etc/nginx/nginx.conf` or `/etc/fstab`), or fix web server file ownership (like `www-data`), this extension saves you from having to drop into the terminal. You can manage protected files, directories, and their permissions directly from the comfort of the VS Code editor!

![Screenshot](https://raw.githubusercontent.com/rezbouchabou/remote-ssh-sudo/main/images/cmd.png)

## Features

This extension adds several commands to VS Code, allowing you to bypass permission denied errors seamlessly:

*   **Save as Root:** Save the currently open protected file using `sudo`.
*   **Save as Specified User...:** Prompts for a username and saves the current file as that specific user.
*   **New File as Root / Specified User:** Create a new file anywhere on the remote file system.
*   **New Folder as Root / Specified User:** Create directories (including nested directories) with elevated privileges.
*   **Delete as Root:** Permanently delete protected files or directories (runs `rm -rf`).
*   **Change Permissions (chmod):** Quickly apply new numeric permissions to any file or folder (e.g., `0775`, `644`, `777`).
*   **Change Owner/Group (chown):** Easily reassign the user and group ownership of a file or folder (e.g., `www-data:www-data`, `ubuntu:ubuntu`).
*   **Recursive Operations:** Automatically detects if you are modifying a folder's permissions or ownership and interactively asks if you want to apply the changes recursively (`-R`) to all files inside it.

### Explorer Context Menu Integration
You don't need to memorize commands! You can simply right-click in the VS Code File Explorer to access:
*   `New File as Root...` (When clicking on a folder)
*   `New Folder as Root...` (When clicking on a folder)
*   `Delete as Root` (When clicking on a file or folder)
*   `Change Permissions (chmod)...` (When clicking on a file or folder)
*   `Change Owner/Group (chown)...` (When clicking on a file or folder)

![Screenshot](https://raw.githubusercontent.com/rezbouchabou/remote-ssh-sudo/main/images/menu.png)

## How It Works

When you trigger a command that requires elevated privileges, the extension uses the native `sudo` command on your remote machine. If `sudo` requires a password, VS Code will securely prompt you to enter it at the top of the screen.

## Extension Settings

This extension contributes the following settings that you can configure in your `settings.json`:

*   `remote-ssh-sudo.command`: The command used to execute sudo. (Default: `"sudo"`)
    *   *Tip: If your system uses a wrapper or has sudo located elsewhere, you can change this to the absolute path, e.g., `"/usr/bin/sudo"`.*
*   `remote-ssh-sudo.extensionsToNotifyOnSave`: A list of extension IDs to notify when a file is saved via this extension. This ensures formatters or linters that trigger "on save" still run properly. (Default: `[]`)

## Requirements

*   You must be connected to a remote machine (e.g., via the official VS Code Remote - SSH extension).
*   The remote system must have `sudo` installed and configured.
*   Your remote user account must have permissions to execute `sudo`.

## Known Limitations

*   Large file transfers over slow SSH connections might trigger a timeout. The default timeout for entering your password or completing the background operation is 60 seconds.
*   VS Code might temporarily display a "Permission Denied" warning when trying to save normally before you trigger the "Save as Root" command.