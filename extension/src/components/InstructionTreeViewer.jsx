import { useState } from "react";
import {
  getProgramName,
  getInstructionDescription,
  shortenAddress,
  getDetailedInstructionAnalysis,
  decodeFunctionFromDiscriminator,
  analyzeParameters,
} from "./traceUtils";

function InstructionTreeViewer({ instructions = [] }) {
  const [expandedInstructions, setExpandedInstructions] = useState(new Set());

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedInstructions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedInstructions(newExpanded);
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  };

  if (!Array.isArray(instructions) || instructions.length === 0) {
    return (
      <div className="tree-viewer-empty">
        <p>No instructions available</p>
      </div>
    );
  }

  return (
    <div className="instruction-tree-viewer">
      <div className="tree-stats">
        <div className="tree-stat">
          <span className="stat-label">Total Instructions</span>
          <span className="stat-value">{instructions.length}</span>
        </div>
        <div className="tree-stat">
          <span className="stat-label">Programs Involved</span>
          <span className="stat-value">
            {new Set(instructions.map((i) => i.programId)).size}
          </span>
        </div>
        <div className="tree-stat">
          <span className="stat-label">Total Accounts</span>
          <span className="stat-value">
            {instructions.reduce((sum, i) => sum + (i.accountCount || 0), 0)}
          </span>
        </div>
      </div>

      <div className="tree-nodes">
        {instructions.map((instruction, index) => {
          const id = `ix-${index}`;
          const isExpanded = expandedInstructions.has(id);
          const programName = getProgramName(instruction.programId);
          const description = getInstructionDescription(instruction);
          const decoded = instruction.decoded || {};
          const analysis = getDetailedInstructionAnalysis(instruction);
          const decodedFuncName =
            decoded.discriminator &&
            decodeFunctionFromDiscriminator(decoded.discriminator);
          const { parameters, paramCount, requiredCount } =
            analyzeParameters(decoded);

          return (
            <div key={id} className="tree-node">
              <div
                className={`tree-node-header ${isExpanded ? "expanded" : ""}`}
                onClick={() => toggleExpanded(id)}
              >
                <span className="tree-expand-icon">
                  {isExpanded ? "▼" : "▶"}
                </span>
                <div className="tree-node-info">
                  <div className="tree-node-title">
                    <span className="instruction-index">#{index}</span>
                    <span className="instruction-action">
                      {decodedFuncName || decoded.type || "Execute"}
                    </span>
                    {paramCount > 0 && (
                      <span className="param-badge">
                        {paramCount} param{paramCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="tree-node-subtitle">
                    <code className="program-id-mini">
                      {shortenAddress(instruction.programId)}
                    </code>
                    <span className="program-name">{programName}</span>
                  </div>
                </div>
                <div className="tree-node-badge">
                  <span className="badge-accounts">
                    {instruction.accountCount || 0} accounts
                  </span>
                  {paramCount > 0 && (
                    <span className="badge-params">
                      {paramCount} parameters
                    </span>
                  )}
                  {instruction.dataLength && instruction.dataLength > 0 && (
                    <span className="badge-data">
                      {instruction.dataLength}B data
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="tree-node-content">
                  <div className="tree-section">
                    <h5 className="tree-section-title">📝 Description</h5>
                    <p className="tree-description">{description}</p>
                  </div>

                  <div className="tree-section">
                    <h5 className="tree-section-title">
                      ⚙️ Function Signature
                    </h5>
                    <div className="function-signature">
                      <div className="sig-row">
                        <span className="sig-label">Function</span>
                        <code className="sig-value">
                          {decodedFuncName || decoded.type || "execute"}
                        </code>
                      </div>
                      {decoded.discriminator && (
                        <div className="sig-row">
                          <span className="sig-label">Discriminator</span>
                          <code className="sig-discriminator">
                            {decoded.discriminator}
                          </code>
                        </div>
                      )}
                      <div className="sig-row">
                        <span className="sig-label">Parameters</span>
                        <span className="sig-value">
                          {paramCount} total
                          {requiredCount < paramCount
                            ? ` (${requiredCount} required)`
                            : requiredCount > 0
                              ? " (all required)"
                              : " (none)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {parameters.length > 0 && (
                    <div className="tree-section">
                      <h5 className="tree-section-title">📋 Parameters</h5>
                      <div className="parameters-list">
                        {parameters.map((param, pIdx) => (
                          <div
                            key={`${id}-param-${pIdx}`}
                            className="parameter-item"
                          >
                            <div className="param-header">
                              <span className="param-name">{param.name}</span>
                              <span className={`param-type type-${param.type}`}>
                                {param.type}
                              </span>
                              {!param.isRequired && (
                                <span className="param-optional">optional</span>
                              )}
                            </div>
                            <code className="param-value">
                              {param.stringValue}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="tree-section">
                    <h5 className="tree-section-title">🔗 Program</h5>
                    <div className="program-details">
                      <div className="detail-row">
                        <span className="detail-label">Program ID</span>
                        <code
                          className="detail-value address-full"
                          title={instruction.programId}
                          onClick={() => copyToClipboard(instruction.programId)}
                        >
                          {instruction.programId}
                        </code>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Type</span>
                        <span className="detail-value">{programName}</span>
                      </div>
                    </div>
                  </div>

                  {decoded && Object.keys(decoded).length > 0 && (
                    <div className="tree-section">
                      <h5 className="tree-section-title">
                        📊 Raw Decoded Data
                      </h5>
                      <div className="decoded-fields-tree">
                        {Object.entries(decoded).map(([key, value]) => (
                          <div key={key} className="decoded-field">
                            <span className="field-key">{key}</span>
                            <span className="field-separator">:</span>
                            <code className="field-value">
                              {typeof value === "string" && value.length > 60
                                ? `${value.slice(0, 60)}...`
                                : typeof value === "object"
                                  ? JSON.stringify(value).slice(0, 60)
                                  : String(value)}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="tree-section">
                    <h5 className="tree-section-title">📊 Metadata</h5>
                    <div className="metadata-grid">
                      <div className="metadata-item">
                        <span className="meta-label">Account Count</span>
                        <span className="meta-value">
                          {instruction.accountCount || 0}
                        </span>
                      </div>
                      <div className="metadata-item">
                        <span className="meta-label">Data Size</span>
                        <span className="meta-value">
                          {instruction.dataLength || 0} bytes
                        </span>
                      </div>
                      <div className="metadata-item">
                        <span className="meta-label">Data Encoding</span>
                        <span className="meta-value">
                          {instruction.dataEncoding || "base64"}
                        </span>
                      </div>
                      <div className="metadata-item">
                        <span className="meta-label">Index</span>
                        <span className="meta-value">{index}</span>
                      </div>
                    </div>
                  </div>

                  {instruction.dataPreviewHex && (
                    <details className="tree-hex-preview">
                      <summary>📜 Hex Data Preview</summary>
                      <pre className="hex-content">
                        {instruction.dataPreviewHex}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InstructionTreeViewer;
