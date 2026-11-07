import { undo, redo } from '@codemirror/commands';

export function createCommands(editor, ctx) {
  const cmd = (label, icon, title, run, shortcut = '') => ({ label, icon, title: shortcut ? `${title} (${shortcut})` : title, shortcut, run });

  return {
    undo: cmd('撤销', 'undo', '撤销', () => undo(editor.view), 'Ctrl+Z'),
    redo: cmd('重做', 'redo', '重做', () => redo(editor.view), 'Ctrl+Y'),
    h1: cmd('一级标题', 'heading1', '一级标题', () => editor.prefixLines('# '), 'Ctrl+Alt+1'),
    h2: cmd('二级标题', 'heading2', '二级标题', () => editor.prefixLines('## '), 'Ctrl+Alt+2'),
    h3: cmd('三级标题', 'heading3', '三级标题', () => editor.prefixLines('### '), 'Ctrl+Alt+3'),
    bold: cmd('粗体', 'bold', '粗体', () => editor.wrap('**', '**', '粗体文本'), 'Ctrl+B'),
    italic: cmd('斜体', 'italic', '斜体', () => editor.wrap('*', '*', '斜体文本'), 'Ctrl+I'),
    strike: cmd('删除线', 'strikethrough', '删除线', () => editor.wrap('~~', '~~', '删除线'), 'Ctrl+Shift+X'),
    code: cmd('行内代码', 'code', '行内代码', () => editor.wrap('`', '`', 'code'), 'Ctrl+Shift+C'),
    link: cmd('链接', 'link', '插入链接', () => {
      const sel = editor.view.state.sliceDoc(editor.selection().from, editor.selection().to);
      const label = sel || '链接文字';
      editor.insert(`[${label}](https://example.com)`, 20);
    }, 'Ctrl+Shift+K'),
    image: cmd('插入图片', 'image', '插入图片', () => ctx.openImagePicker()),
    quote: cmd('引用', 'quote', '块引用', () => editor.prefixLines('> '), 'Ctrl+Shift+9'),
    bullet: cmd('无序列表', 'list', '无序列表', () => editor.prefixLines('- '), 'Ctrl+Shift+8'),
    ordered: cmd('有序列表', 'list-ordered', '有序列表', () => editor.prefixLines((i) => `${i + 1}. `), 'Ctrl+Shift+7'),
    task: cmd('任务列表', 'check-square', '任务列表', () => editor.prefixLines('- [ ] ')),
    table: cmd('表格', 'table', '插入表格', () => {
      editor.insert('\n| 列 A | 列 B | 列 C |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |\n');
    }),
    hr: cmd('分隔线', 'minus', '插入分隔线', () => editor.insert('\n***\n')),
    'slide-break': cmd('幻灯片分页', 'presentation', '插入幻灯片分页符 (---)', () => editor.insert('\n\n---\n\n')),
    codeblock: cmd('代码块', 'code-block', '插入代码块', () => {
      editor.insert('\n```javascript\n// 在此输入代码\n```\n', 4);
    }),
    math: cmd('数学公式', 'sigma', '插入块级公式', () => editor.insert('\n$$\nE = mc^2\n$$\n', 3)),
    mermaid: cmd('流程图', 'git-branch', '插入 Mermaid 图表', () => {
      editor.insert('\n```mermaid\ngraph LR\n  A[开始] --> B[处理] --> C[完成]\n```\n', 4);
    }),
    save: cmd('保存', 'save', '立即保存到本地', () => ctx.save(), 'Ctrl+S'),
    palette: cmd('命令面板', 'sparkles', '打开命令面板', () => ctx.openPalette(), 'Ctrl+K'),
  };
}

export const TOOLBAR_LAYOUT = [
  ['h1', 'h2', 'h3'],
  ['bold', 'italic', 'strike', 'code'],
  ['link', 'table', 'image'],
  ['quote', 'bullet', 'ordered'],
];
