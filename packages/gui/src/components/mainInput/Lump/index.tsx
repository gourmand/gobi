import { LumpToolbar } from "./LumpToolbar/LumpToolbar";

/**
 * Simplified toolbar component that only shows the toolbar without expansion
 */
export function Lump() {
  return (
    <div className="bg-input rounded-t-default border-command-border mx-1.5 border-t border-r border-l">
      <div className="xs:px-2 px-1 py-0.5">
        <LumpToolbar />
      </div>
    </div>
  );
}
