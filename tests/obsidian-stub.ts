// Stub file for the 'obsidian' module in tests
// The actual obsidian npm package has an empty main field, so we alias it here.

function mockEl(): any {
  const el: any = {
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: (c: any) => c,
    removeChild: () => {},
    remove: () => {},
    createDiv: (_opts?: any) => mockEl(),
    createEl: (_tag?: string, _opts?: any) => mockEl(),
    createSpan: (_opts?: any) => mockEl(),
    setText: (_text: string) => {},
    empty: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendText: (_text: string) => {},
    setAttribute: () => {},
    getAttribute: () => null,
    children: [],
    scrollTop: 0,
    scrollHeight: 0,
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    setSelectionRange: () => {},
    focus: () => {},
    inputEl: null as any,
  };
  el.inputEl = el;
  return el;
}

export class Plugin {
  app: any;
  manifest: any;
  constructor(app?: any, manifest?: any) { this.app = app; this.manifest = manifest; }
  onload() {}
  onunload() {}
  loadData(): Promise<any> { return Promise.resolve({}); }
  saveData(_data: any): Promise<void> { return Promise.resolve(); }
  registerView(_type: string, _viewCreator: any) {}
  addSettingTab(_tab: any) {}
  addCommand(_command: any) {}
  registerEvent(_eventRef: any) {}
  addRibbonIcon(_icon: string, _title: string, _callback: any) { return mockEl(); }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;
  constructor(app?: any, plugin?: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = mockEl();
  }
  display() {}
  hide() {}
}

export class ItemView {
  app: any;
  leaf: any;
  containerEl: any;
  contentEl: any;
  constructor(leaf?: any) {
    this.leaf = leaf;
    this.app = leaf?.app;
    this.containerEl = mockEl();
    this.contentEl = this.containerEl;
  }
  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  async onOpen() {}
  async onClose() {}
}

export class Setting {
  constructor(_containerEl?: any) {}
  setName(_name: string) { return this; }
  setDesc(_desc: string) { return this; }
  addText(_cb: any) { return this; }
  addTextArea(_cb: any) { return this; }
  addToggle(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
  addSlider(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
}

export class MarkdownRenderer {
  static renderMarkdown(_markdown: string, _el: any, _sourcePath: string, _component: any): Promise<void> {
    return Promise.resolve();
  }
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
}

export class WorkspaceLeaf {
  app: any;
  constructor(app?: any) { this.app = app; }
}

export class MarkdownView {
  app: any;
  file: any;
  editor: any;
  constructor(leaf?: any) { this.app = leaf?.app; }
  getViewType(): string { return 'markdown'; }
}
