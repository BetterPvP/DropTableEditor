import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './InviteCodeManager.css'

function InviteCodeManager() {
  const [codes, setCodes] = useState([])
  const [newCode, setNewCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCodes()
  }, [])

  const loadCodes = async () => {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setCodes(data)
    }
  }

  const generateCode = () => {
    const randomCode = 'ADMIN-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    setNewCode(randomCode)
  }

  const addCode = async () => {
    if (!newCode.trim()) return

    setLoading(true)
    const { error } = await supabase
      .from('invite_codes')
      .insert({ code: newCode.trim() })

    if (error) {
      alert('Error creating invite code: ' + error.message)
    } else {
      setNewCode('')
      loadCodes()
    }
    setLoading(false)
  }

  const deleteCode = async (id) => {
    if (!confirm('Delete this invite code?')) return

    await supabase.from('invite_codes').delete().eq('id', id)
    loadCodes()
  }

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code)
    alert('Code copied to clipboard!')
  }

  return (
    <div className="invite-manager">
      <h2>Invite Code Manager</h2>
      <p className="info-text">
        Generate invite codes to allow new team members to register.
      </p>

      <div className="add-code-section">
        <input
          type="text"
          placeholder="Enter custom code or generate one"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          className="code-input"
        />
        <button onClick={generateCode} className="btn-generate" disabled={loading}>
          Generate Random
        </button>
        <button onClick={addCode} className="btn-add" disabled={loading || !newCode.trim()}>
          Create Code
        </button>
      </div>

      <div className="codes-list">
        <h3>Existing Codes</h3>
        {codes.length === 0 ? (
          <p className="empty-message">No invite codes yet.</p>
        ) : (
          <table className="codes-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Used By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id} className={code.is_used ? 'used' : ''}>
                  <td className="code-cell">
                    <span className="code-text">{code.code}</span>
                    <button
                      onClick={() => copyToClipboard(code.code)}
                      className="btn-copy"
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                  </td>
                  <td>
                    <span className={`status-badge ${code.is_used ? 'used' : 'available'}`}>
                      {code.is_used ? 'Used' : 'Available'}
                    </span>
                  </td>
                  <td>{code.used_by || '—'}</td>
                  <td>{new Date(code.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => deleteCode(code.id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default InviteCodeManager