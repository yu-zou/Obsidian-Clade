import { App, PluginSettingTab, Setting } from 'obsidian';
import type CladePlugin from './main';

export class CladeSettingTab extends PluginSettingTab {
  plugin: CladePlugin;

  constructor(app: App, plugin: CladePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Clade Settings' });
    const s = this.plugin.settings;

    new Setting(containerEl)
      .setName('OpenCode binary path')
      .setDesc('Path to the opencode binary. Default uses $PATH.')
      .addText(text => text
        .setPlaceholder('opencode')
        .setValue(s.opencodeBinaryPath)
        .onChange(async (val) => {
          this.plugin.settings.opencodeBinaryPath = val || 'opencode';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Environment variables')
      .setDesc('One per line: KEY=VALUE')
      .addTextArea(text => {
        text
          .setPlaceholder('OPENCODE_API_KEY=sk-...')
          .setValue(Object.entries(s.envVars).map(([k, v]) => `${k}=${v}`).join('\n'))
          .onChange(async (raw) => {
            const parsed: Record<string, string> = {};
            for (const line of raw.split('\n')) {
              const eq = line.indexOf('=');
              if (eq > 0) parsed[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
            }
            this.plugin.settings.envVars = parsed;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        return text;
      });

    new Setting(containerEl)
      .setName('Max reconnect attempts')
      .addSlider(slider => slider
        .setLimits(1, 20, 1)
        .setValue(s.maxReconnectAttempts)
        .setDynamicTooltip()
        .onChange(async (v) => {
          this.plugin.settings.maxReconnectAttempts = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Reconnect base delay (ms)')
      .addSlider(slider => slider
        .setLimits(500, 30000, 500)
        .setValue(s.reconnectBaseDelayMs)
        .setDynamicTooltip()
        .onChange(async (v) => {
          this.plugin.settings.reconnectBaseDelayMs = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sessions directory')
      .setDesc('Relative to vault root')
      .addText(text => text
        .setPlaceholder('.clade/sessions')
        .setValue(s.sessionsDir)
        .onChange(async (v) => {
          this.plugin.settings.sessionsDir = v || '.clade/sessions';
          await this.plugin.saveSettings();
        }));
  }
}
