'use strict';

// https://help.github.com/articles/organizing-information-with-tables/

import { languages, workspace, CancellationToken, DocumentFormattingEditProvider, ExtensionContext, FormattingOptions, Range, TextDocument, TextEdit } from 'vscode';

export function activate(context: ExtensionContext) {
    context.subscriptions.push(languages.registerDocumentFormattingEditProvider('markdown', new MarkdownDocumentFormatter))
}

export function deactivate() { }

class MarkdownDocumentFormatter implements DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {
        let edits: TextEdit[] = [];
        let tables = this.detectTables(document.getText());
        tables.forEach(table => {
            edits.push(new TextEdit(this.getRange(document, table), this.formatTable(table)));
        });
        return edits;
    }

    private detectTables(text: string) {
        const lineBreak = '\\r?\\n';
        const contentLine = '\\|?.*\\|.*\\|?';
        const hyphenLine = '\\|?[ :]*[-]{3,}[- :\\|]*\\|?';
        const tableRegex = new RegExp(contentLine + lineBreak + hyphenLine + '(?:' + lineBreak + contentLine + ')*', 'g');
        return text.match(tableRegex);
    }

    private getRange(document: TextDocument, text: string) {
        let documentText = document.getText();
        let start = document.positionAt(documentText.indexOf(text));
        let end = document.positionAt(documentText.indexOf(text) + text.length);
        return new Range(start, end);
    }

    private formatTable(text: string) {
        let rows = text.split(/\r?\n/g);
        let content = rows.map(row => {
            // Escape 
            // 1. `|` in code span
            // 2. `\|`
            while (/`([^` ]*?)\|([^` ]*?)`/.test(row)) {
                // Use `while` because there might be more than one `|` in a code span
                row = row.replace(/`([^` ]*?)\|([^` ]*?)`/, '`$1%7c$2`');
            }
            row = row.replace(/\\\|/g, '\\%7c');
            return row.trim().replace(/^\|/g, '').replace(/\|$/g, '').trim().split(/\s*\|\s*/g).map(cell => {
                return cell.replace(/%7c/g, '|')
            });
        });
        // Normalize the num of hyphen
        content[1] = content[1].map(cell => {
            if (/:-+:/.test(cell)) {
                return ':---:';
            } else if (/:-+/.test(cell)) {
                return ':---';
            } else if (/-+:/.test(cell)) {
                return '---:';
            } else if (/-+/.test(cell)) {
                return '---';
            }
        });
        let colWidth = Array(content[0].length).fill(3);
        let cn = /[\u4e00-\u9eff，。《》？；：‘“’”（）【】、—]/g;
        content.forEach(row => {
            row.forEach((cell, i) => {
                // Treat Chinese characters as 2 English characters
                let cellLength = cell.length;
                if (cn.test(cell)) {
                    cellLength += cell.match(cn).length;
                }
                if (colWidth[i] < cellLength) {
                    colWidth[i] = cellLength;
                }
            });
        });
        // Format
        content[1] = content[1].map((cell, i) => {
            if (cell == ':---:') {
                return ':' + '-'.repeat(colWidth[i] - 2) + ':';
            } else if (cell == ':---') {
                return ':' + '-'.repeat(colWidth[i] - 1);
            } else if (cell == '---:') {
                return '-'.repeat(colWidth[i] - 1) + ':';
            } else if (cell == '---') {
                return '-'.repeat(colWidth[i]);
            }
        });
        return content.map(row => {
            let cells = row.map((cell, i) => {
                let cellLength = colWidth[i];
                if (cn.test(cell)) {
                    cellLength -= cell.match(cn).length;
                }
                return (cell + ' '.repeat(cellLength)).slice(0, cellLength);
            });
            return '| ' + cells.join(' | ') + ' |';
        }).join(<string>workspace.getConfiguration("files").get("eol"));
    }
}
