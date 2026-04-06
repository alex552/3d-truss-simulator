import { useMemo } from 'react'
import type { Member, Node2D, TrussAnalysisResult } from '../types'

type AnalysisPanelProps = {
  analysis: TrussAnalysisResult
  nodes: Node2D[]
  members: Member[]
  displacementDisplayScale: number
}

export function AnalysisPanel({
  analysis,
  nodes,
  members,
  displacementDisplayScale,
}: AnalysisPanelProps) {
  const reactionRows = useMemo(
    () =>
      nodes
        .map((node) => analysis.reactions.find((reaction) => reaction.nodeId === node.id))
        .filter(isDefined),
    [analysis.reactions, nodes],
  )

  const memberRows = useMemo(
    () =>
      members
        .map((member) => ({
          member,
          result: analysis.memberResults.find((memberResult) => memberResult.memberId === member.id),
        }))
        .filter(hasMemberResult),
    [analysis.memberResults, members],
  )

  return (
    <section className="panel analysis-panel">
      <div className="panel-header analysis-panel-header">
        <div>
          <h2>Analysis</h2>
          <p>Live truss results update whenever geometry, supports, loads, or member stiffness changes.</p>
        </div>
        <div className={`analysis-status analysis-status-${analysis.status}`}>
          {formatStatus(analysis.status)}
        </div>
      </div>

      <div className="analysis-content">
        <div className="analysis-summary-grid">
          <div className="analysis-summary-card">
            <span className="analysis-summary-label">Determinacy</span>
            <strong>{formatDeterminacy(analysis.determinacy)}</strong>
            <span className="analysis-summary-value">
              m + r - 2j = {analysis.memberCount} + {analysis.reactionCount} - 2 x {analysis.jointCount} ={' '}
              {analysis.determinacyValue}
            </span>
          </div>

          <div className="analysis-summary-card">
            <span className="analysis-summary-label">Max displacement</span>
            <strong>{formatDisplacement(analysis.maxDisplacementMeters)}</strong>
            <span className="analysis-summary-value">
              Display scale {displacementDisplayScale > 0 ? `${displacementDisplayScale.toFixed(1)}x` : 'n/a'}
            </span>
          </div>
        </div>

        {analysis.errors.length > 0 ? (
          <div className="analysis-messages">
            {analysis.errors.map((error) => (
              <p key={error} className="analysis-message analysis-message-error">
                {error}
              </p>
            ))}
          </div>
        ) : null}

        {analysis.warnings.length > 0 ? (
          <div className="analysis-messages">
            {analysis.warnings.map((warning) => (
              <p key={warning} className="analysis-message analysis-message-warning">
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <div className="analysis-tables">
          <div className="analysis-table-card">
            <h3>Support reactions</h3>
            {reactionRows.length > 0 ? (
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Rx</th>
                    <th>Rz</th>
                  </tr>
                </thead>
                <tbody>
                  {reactionRows.map((reaction) => (
                    <tr key={reaction.nodeId}>
                      <td>{formatEntityId(reaction.nodeId)}</td>
                      <td>{formatSigned(reaction.xKn)} kN</td>
                      <td>{formatSigned(reaction.zKn)} kN</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="analysis-empty">No reaction results available.</p>
            )}
          </div>

          <div className="analysis-table-card">
            <h3>Member axial forces</h3>
            {memberRows.length > 0 ? (
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Force</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map(({ member, result }) => (
                    <tr key={member.id}>
                      <td>{formatEntityId(member.id)}</td>
                      <td>{formatSigned(result.axialForceKn)} kN</td>
                      <td className={`analysis-force-state analysis-force-state-${result.state}`}>
                        {result.state}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="analysis-empty">No member forces available.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatStatus(status: TrussAnalysisResult['status']) {
  if (status === 'stable-determinate') {
    return 'Stable determinate'
  }

  if (status === 'stable-indeterminate') {
    return 'Stable indeterminate'
  }

  return status === 'unstable' ? 'Unstable' : 'Invalid'
}

function formatDeterminacy(determinacy: TrussAnalysisResult['determinacy']) {
  if (determinacy === 'mechanism') {
    return 'Mechanism'
  }

  return determinacy === 'determinate' ? 'Determinate' : 'Indeterminate'
}

function formatEntityId(id: string) {
  return id.slice(0, 8)
}

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatDisplacement(valueInMeters: number) {
  if (valueInMeters === 0) {
    return '0.000 mm'
  }

  return `${(valueInMeters * 1000).toFixed(3)} mm`
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function hasMemberResult(
  row: { member: Member; result: TrussAnalysisResult['memberResults'][number] | undefined },
): row is { member: Member; result: TrussAnalysisResult['memberResults'][number] } {
  return row.result !== undefined
}
