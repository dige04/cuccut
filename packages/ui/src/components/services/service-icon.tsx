import type { ComponentProps } from 'react';
import { Code as CodeLine, Globe, MonitorSmartphone, Plug, type LucideIcon } from 'lucide-react';
import { createIcon } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Code from '@react-spectrum/s2/icons/Code';
import DeviceMultiscreen from '@react-spectrum/s2/icons/DeviceMultiscreen';
import GlobeGrid from '@react-spectrum/s2/icons/GlobeGrid';
import type { ServiceId } from '../../model/services.ts';

/**
 * MCP protocol mark: not in the S2 workflow icons, so it is drawn with the stroke geometry of the prototype designs/cuccut/app/icons.jsx `mcp` on a 20×20 grid,
 * 1.5 stroke width, using only currentColor. It is used only for the MCP service entry (product design §2.1).
 */
export const McpIcon = createIcon((props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.85 9.46 L9.64 2.67 C10.58 1.73 12.1 1.73 13.03 2.67 C13.97 3.61 13.97 5.13 13.03 6.07 L7.91 11.19" />
    <path d="M7.98 11.12 L13.03 6.07 C13.97 5.13 15.49 5.13 16.43 6.07 L16.46 6.1 C17.4 7.04 17.4 8.56 16.46 9.5 L10.32 15.63 C10.01 15.95 10.01 16.45 10.32 16.77 L11.58 18.03" />
    <path d="M11.34 4.37 L6.31 9.39 C5.38 10.33 5.38 11.85 6.31 12.78 C7.25 13.72 8.77 13.72 9.71 12.78 L14.73 7.76" />
  </svg>
));

/** Stop: prototype icons.jsx `stop` (a hollow rounded square derived from Pause); S2 has no matching workflow icon. */
export const StopIcon = createIcon((props) => (
  <svg {...props} viewBox="0 0 20 20" fill="currentColor">
    <path d="M15.75,18H4.25c-1.24072,0-2.25-1.00977-2.25-2.25V4.25c0-1.24023,1.00928-2.25,2.25-2.25h11.5c1.24072,0,2.25,1.00977,2.25,2.25v11.5c0,1.24023-1.00928,2.25-2.25,2.25ZM4.25,3.5c-.41357,0-.75.33691-.75.75v11.5c0,.41309.33643.75.75.75h11.5c.41357,0,.75-.33691.75-.75V4.25c0-.41309-.33643-.75-.75-.75H4.25Z" />
  </svg>
));

/**
 * Marks for the four services (prototype page-services.jsx `ServiceIcon`): MCP uses the protocol mark, remote compute is multiple screens, Web is a globe.
 * The model API has no icon of its own in the prototype (it is a section of the Web service page), so it uses S2's Code (interface). It switches to a warning on error.
 */
export const SERVICE_ICON = { mcp: McpIcon, remote: DeviceMultiscreen, web: GlobeGrid, 'model-api': Code } as const;

/** The services in lucide, for the page chrome (the Services rail and overview cards). */
export const SERVICE_RAIL_ICON: Record<ServiceId, LucideIcon> = { mcp: Plug, remote: MonitorSmartphone, web: Globe, 'model-api': CodeLine };

export function ServiceIcon({
  id,
  error = false,
  styles,
}: {
  id: ServiceId;
  error?: boolean;
  styles?: ComponentProps<typeof GlobeGrid>['styles'];
}) {
  const Icon = error ? AlertTriangle : SERVICE_ICON[id];
  return <Icon styles={styles} />;
}
