import { ShieldCheck } from 'lucide-react';

const PRIVACY_POLICY_URL = 'https://github.com/yuhhhy/AskInPage/blob/main/PRIVACY.md';

export function PrivacyDisclosure() {
  return (
    <aside className="privacy-disclosure" aria-labelledby="privacy-disclosure-title">
      <ShieldCheck size={19} aria-hidden="true" />
      <div>
        <strong id="privacy-disclosure-title">数据发送说明</strong>
        <p>发起解释或翻译时，选中文字、相关网页上下文、页面标题与地址以及追加问题会发送到你配置的模型服务。快速模式仅发送当前段落和选中文字。AskInPage 开发者不会接收或保存这些内容。</p>
        <p>API Key 仅保存在本机扩展存储中，不参与浏览器同步。<a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">查看隐私政策</a></p>
      </div>
    </aside>
  );
}
