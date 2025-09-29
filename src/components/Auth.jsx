import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Auth.css'

function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (isSignUp) {
        // Validate invite code
        if (!inviteCode.trim()) {
          throw new Error('Invite code is required')
        }

        const { data: codeData, error: codeError } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', inviteCode.trim())
          .eq('is_used', false)
          .single()

        if (codeError || !codeData) {
          throw new Error('Invalid or already used invite code')
        }

        // Sign up user
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        // Mark invite code as used
        await supabase
          .from('invite_codes')
          .update({ is_used: true, used_by: email })
          .eq('code', inviteCode.trim())

        setMessage({ type: 'success', text: 'Check your email for the confirmation link!' })
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Minecraft Drop Table Editor</h1>
          <p>Collaborate on drop table configurations</p>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="inviteCode">Invite Code</label>
              <input
                id="inviteCode"
                type="text"
                placeholder="Enter your invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          {message && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="toggle-button"
            disabled={loading}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Auth