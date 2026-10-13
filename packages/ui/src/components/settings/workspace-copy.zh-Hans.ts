import type { WorkspaceMessages } from './workspace-copy.ts';

export const zhHans: WorkspaceMessages = {
  aside: '这里的一切对所有项目生效',
  generalBlurb: 'CucCut 的外观与语言、下载存放的位置，以及它可以从网上取哪些东西。',
  shortcutsBlurb: '在 CucCut 任何地方都能用的按键。编辑器的快捷键在帮助（F1）里。',
  shortcutsPanel: '在 CucCut 任何地方',
  fontsBlurb: '字幕与标题用的字体：从哪里来，以及这台电脑上已经有的。',
  privacyBlurb: '哪些留在这台电脑上，哪些可以发给云端服务商，以及 Agent 不用问就能做什么。',
  diagnosticsBlurb: '本机的 Runtime、它的日志，以及后台任务可以用这台电脑的多少资源。',
  aboutBlurb: '应用、界面与 Runtime 的版本，以及 CucCut 怎样更新。',
  checking: '正在检测…',
  noAgent: '还没有可用的 Agent',
  shortcutCount: (n) => `${n} 个快捷键`,
  skillCount: (n) => (n === 0 ? '还没有' : `${n} 个 Skill`),
  glossaryCount: (n) => (n === 0 ? '还没有' : `${n} 张术语表`),
  grantCount: (n) => (n === 0 ? '没有生效的授权' : `${n} 条授权生效中`),
  runtimeOn: 'Runtime 已连接',
  runtimeOff: 'Runtime 未连接',
  installed: (n) => (n === 0 ? '还没有安装' : `已安装 ${n} 个`),
  noDefault: '还没有默认',
  version: (version) => `版本 ${version}`,
  desktopOnly: '仅桌面版',
  notYet: '暂不可用',
  loadFailed: '加载失败',
  fontsSummary: '用于字幕与标题',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? '已撰写偏好'
        : answers === 1
          ? '已撰写偏好，1 条回答'
          : `已撰写偏好，${answers} 条回答`
      : answers === 0
        ? '尚无偏好'
        : answers === 1
          ? '1 条回答'
          : `${answers} 条回答`,
  ruleCount: (n, off) => (n === 0 ? '暂无' : `${n === 1 ? '1 条规则' : `${n} 条规则`}${off ? `，${off} 条已关闭` : ''}`),
};
