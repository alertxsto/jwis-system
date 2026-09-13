import React from "react";

/**
 * The opening block of every workspace: what this screen is, and the controls
 * that scope it. Having one component means the three workspaces cannot drift
 * into three different heading styles, which is what happened when each
 * workspace hand-rolled its own header.
 */
export function WorkspaceHeader({ title, description, children }) {
  return (
    <header className="workspace-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="workspace-header-controls">{children}</div>}
    </header>
  );
}
