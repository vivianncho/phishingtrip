import { useGetCapabilities } from '@workspace/api-client-react';
import { Busy, Copy, ErrorCard, Page, Providers, s } from '@/components/Ocean';

export default function HelpScreen() {
  const capabilities = useGetCapabilities({ query: { staleTime: 0 } });
  return <Page title="A little clarity" back>
    <Copy style={s.heading}>Here to help.{'\n'}<Copy style={[s.heading, s.accent]}>Not to overpromise.</Copy></Copy>
    <Copy style={s.h2}>What a check means</Copy>
    <Copy>Official match means the exact number appears in a current official source. It does not prove who is calling. Not verified means evidence is missing, stale or conflicting—not that a number is fraudulent.</Copy>
    <Copy>Reputation reports are currently unavailable. Number-format metadata is not evidence of ownership, reputation or safety.</Copy>
    <Copy style={s.h2}>Your number, your tap</Copy>
    <Copy>Enter a single number and explicitly choose its country or international format. Only that number, your choice of country and optional claimed company go to the service after you tap Check.</Copy>
    <Copy>The service does not store your submitted number or check history. The app keeps only the current check in memory and clears it when you leave Check or background the app. My Trips stores curated company IDs locally, never checked numbers or results.</Copy>
    <Copy>If the server operator enables optional Twilio Basic metadata, Twilio receives the number. Its retention follows its own policies. It does not add reputation reports.</Copy>
    <Copy style={s.h2}>Safari is separate</Copy>
    <Copy>This Expo app cannot inspect Safari pages, search results, tabs or browsing history. There is no Safari extension installed or enabled by this app.</Copy>
    <Copy>The companion browsing design is a separate prototype. A future native Safari Web Extension would need its own installation, explicit website permissions and a selected-number tap-to-check flow. No automatic scanning or page uploads are part of this app.</Copy>
    <Copy style={s.h2}>If you’re feeling rushed</Copy>
    <Copy>Pause. Use your booking confirmation or the company’s own app for another way to get help. Never share a password or one-time code with an incoming caller.</Copy>
    {capabilities.isPending ? <Busy text="Loading availability…" /> : capabilities.isError ? <ErrorCard text="Current provider availability couldn’t be loaded." retry={() => { void capabilities.refetch(); }} /> :
      capabilities.data && <>
        <Providers providers={capabilities.data.providers} checkedAt={capabilities.data.checkedAt} />
        <Copy style={s.small}>Official evidence is reviewed for at most {capabilities.data.sourceMaxAgeDays} days. Dates are shown per source; expired or disputed contacts are not recommended alternatives.</Copy>
        {capabilities.data.limitations.map((text, index) => <Copy key={index} style={s.small}>{text}</Copy>)}
      </>}
  </Page>;
}
