import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { setStoredPasscode, isSupabaseConfigured } from '../lib/supabase.js';

export default function Login({ onLogin }) {
  const [code, setCode] = useState('');
  const configured = isSupabaseConfigured();

  const submit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setStoredPasscode(code.trim());
    onLogin();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: '#FAFAFA',
    }}>
      <form onSubmit={submit} style={{
        width: '100%',
        maxWidth: 360,
        padding: 32,
        border: '1px solid #EAEAEA',
        borderRadius: 12,
        background: '#FFFFFF',
        boxShadow: '0 4px 24px -10px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          width: 44, height: 44,
          borderRadius: 10,
          background: '#1A1A1A',
          color: '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Lock size={20} />
        </div>
        <h1 style={{
          fontFamily: 'Lora, serif',
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: 22,
          textAlign: 'center',
          color: '#1A1A1A',
          marginBottom: 4,
        }}>
          Eisenhower Matrix
        </h1>
        <p style={{
          fontFamily: 'NoonnuGothic, Inter, sans-serif',
          fontSize: 12,
          color: '#8B8B8B',
          textAlign: 'center',
          letterSpacing: '0.02em',
          marginBottom: 24,
        }}>
          Passcode를 입력하여 시작하세요
        </p>

        {!configured && (
          <div style={{
            fontFamily: 'NoonnuGothic, sans-serif',
            fontSize: 11,
            color: '#C97B6B',
            padding: '8px 10px',
            background: '#FDF5F3',
            borderRadius: 6,
            marginBottom: 14,
            lineHeight: 1.5,
          }}>
            ⚠️ Supabase 환경변수가 없어 로컬 저장 모드로 동작합니다.
          </div>
        )}

        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            fontFamily: 'Lora, serif',
            fontStyle: 'italic',
            fontSize: 15,
            border: '1px solid #EAEAEA',
            borderRadius: 6,
            outline: 'none',
            background: '#FAFAFA',
          }}
        />
        <button
          type="submit"
          style={{
            width: '100%',
            padding: 12,
            marginTop: 12,
            background: '#1A1A1A',
            color: '#FFF',
            border: 'none',
            borderRadius: 6,
            fontFamily: 'NoonnuGothic, Inter, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
        >
          들어가기
        </button>
        <p style={{
          fontFamily: 'NoonnuGothic, sans-serif',
          fontSize: 10,
          color: '#A0A0A0',
          textAlign: 'center',
          marginTop: 16,
          lineHeight: 1.6,
        }}>
          모든 기기에서 같은 passcode를 입력하면<br/>
          데이터가 실시간으로 동기화됩니다.
        </p>
      </form>
    </div>
  );
}
