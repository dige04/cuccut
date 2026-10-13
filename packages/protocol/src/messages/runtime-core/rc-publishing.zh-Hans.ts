import type { RcPublishingMessages } from './rc-publishing.ts';

export const zhHans: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: '只有所有者可以在这台电脑上的 CucCut 应用中执行此操作。',
  desktopOnly: '授权、发送、记录结果和管理连接只能在这台电脑上的 CucCut 应用中进行。',
  settingsOwnerOnly: '只有所有者可以更改发布日程。请让所有者在发布设置中修改。',
  transferNotAllowed: '日历导入和导出可在 CucCut 应用和命令行中使用。',
  authorizationRequired: '所有者需要先在 CucCut 中授权这个具体发布，代理才能发送它。',
  // Publications.
  publicationArchived: '此发布已归档。请先恢复，再进行更改。',
  publicationLocked: '已发送的目标会保留共享内容。请编辑失败的目标，或准备新的发布。',
  destinationLocked: '该账号的投递已经开始。请先撤回或记录结果，再进行更改。',
  destinationKept: '已发送的目标会保留在发布中。请先撤回或记录结果，再将其移除。',
  destinationAccountFixed: '若要使用其他账号，请移除此目标，并改为添加该账号。',
  destinationNotFound: '该账号已不在此发布中。请重新加载后再试。',
  duplicateAccount: '每个账号只能选择一次。',
  duplicatePlacement: '每个账号的时间只能选择一次。',
  afterExpiry: '请选择此发布过期之前的时间。',
  invalid: '此发布尚未就绪。请修正列出的问题后重试。',
  nothingToSend: '此发布的所有账号都已发送。如需再次发送，请准备新的发布。',
  slotTaken: (p: { account: string }) =>
    `此时间与 ${p.account} 的另一条发布冲突。请选择其他时间，或在发布设置中允许更短的发布间隔。`,
  slotsHaveDestinationTimes:
    '其中一些发布为某个账号设置了专属时间。请先清除这些时间，再预留共享时间。',
  calendarRange: '请选择不超过 93 天的日历范围，且开始时间早于结束时间。',
  archiveInFlight: '归档此发布前，请撤回待处理的投递或记录其结果。',
  // Delivery.
  providerUnsupported: '当前版本的 CucCut 只支持手动发布。请为此连接选择“手动”。',
  notWaiting: '只能撤回正在等待您处理的账号。',
  cancelNotAllowed: '只能取消未发送的账号。请撤回它，或先记录其结果。',
  reconcileFinal: '已发布或已取消的投递属于历史记录。请准备新的发布，而不是修改它。',
  reconcileSending: '请等待当前投递完成后再记录结果。',
  reconcileFutureTime: '请输入网络为此帖子显示的未来时间。',
  // Pinned exports.
  exportRequired: '请先渲染并固定视频。',
  exportChanged: '已批准的导出已更改。发布前请固定一个已验证的导出。',
  exportStale: '固定前请导出当前版本，或选择“渲染并固定”。',
  exportNotFinished: '此导出尚未完成。请等待或选择其他导出。',
  exportNotVideo: '请选择整个视频已完成的 MP4 导出。',
  exportOtherVideo: '此导出属于其他视频或序列。请选择此视频的导出。',
  exportFileMissing: '导出的文件已不在这台电脑上。请重新渲染并固定视频。',
  exportFileChanged: '导出的文件在渲染后已发生变化。请重新渲染并固定视频。',
  pinLocked: '已发送的目标会保留其固定的导出。如需使用其他导出，请准备新的发布。',
  renderFailed: '此发布的导出未能完成。请重新渲染并固定。',
  renderCancelled: '此发布的导出已取消。准备好后请重新渲染并固定。',
  videoNotFound: '这台电脑上找不到此视频。请打开其项目后重试。',
  // Settings, connections and accounts.
  accountNotFound: '此账号已不存在。请重新加载发布设置后再试。',
  connectionNotFound: '此连接已不存在。请重新加载发布设置后再试。',
  defaultAccountMissing: '默认账号已不存在。请重新选择默认账号。',
  connectionProviderFixed: '连接会保留添加时所用的渠道。如需以其他方式发布，请添加新连接。',
  accountIdentityFixed: '账号会保留其连接和网络。请改为添加新账号。',
  accountDuplicate: '此账号已添加到该连接中。',
  accountInUse: (p: { name: string }) =>
    `${p.name} 有待处理、已排期或未确认的帖子。请先记录其结果，再移除该账号。`,
  linkInvalid: '请选择同一网络中、本身未被关联的其他账号。',
  linkCanonical: '其他账号已关联到此账号。请改为将另一渠道关联到此账号。',
  // Copy proposals.
  proposalReason: '基于视频、转录文本和您的写作指南生成的草稿。应用前请先检查。',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut 发布',
  // Calendar transfer and cleanup.
  backupFailed: '无法写入发布数据的备份，因此未导入任何内容。请检查磁盘后重试。',
};
