import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Student {
  id: number;
  name: string;
}

interface ChallengeLog {
  student_id: number;
  log_date: string;
  solved_count: number;
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<ChallengeLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 로그인 및 회원가입 관련 상태
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [loginName, setLoginName] = useState('');
  const [registerName, setRegisterName] = useState('');
  
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');

  const YEAR = 2026;
  const MONTH = 5;

  const getWeekdaysOfMonth = (year: number, month: number): string[] => {
    const weekdays: string[] = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekdays.push(date.toLocaleDateString('sv-SE'));
      }
      date.setDate(date.getDate() + 1);
    }
    return weekdays;
  };

  const weekdays = getWeekdaysOfMonth(YEAR, MONTH);

  const fetchData = async () => {
    setLoading(true);
    const { data: studentData } = await supabase.from('students').select('*').order('id', { ascending: true });
    
    const startDate = `${YEAR}-${String(MONTH).padStart(2, '0')}-01`;
    const endDate = `${YEAR}-${String(MONTH).padStart(2, '0')}-31`;
    const { data: logData } = await supabase.from('challenge_logs').select('student_id, log_date, solved_count').gte('log_date', startDate).lte('log_date', endDate);

    if (studentData) setStudents(studentData);
    if (logData) setLogs(logData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const savedUser = localStorage.getItem('routine_user');
    if (savedUser) setCurrentStudent(JSON.parse(savedUser));
  }, []);

  // 로그인 처리
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return;

    const student = students.find(s => s.name === loginName.trim());
    
    if (student) {
      setCurrentStudent(student);
      setActiveTab('my');
      setLoginName('');
      localStorage.setItem('routine_user', JSON.stringify(student));
    } else {
      alert('등록되지 않은 이름이에요. 회원가입을 먼저 해주세요! 🎀');
    }
  };

  // 회원가입 처리
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim()) return;

    const isExist = students.some(s => s.name === registerName.trim());
    if (isExist) {
      alert('이미 등록된 이름이에요! 다른 이름을 사용해 주세요. 🍰');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .insert([{ name: registerName.trim() }])
      .select();

    if (!error && data && data.length > 0) {
      alert('회원가입이 완료되었어요! 로그인을 진행해 주세요. 💕');
      setRegisterName('');
      setIsRegisterMode(false);
      fetchData();
    } else {
      alert('회원가입 중 오류가 발생했어요.');
    }
  };

  const handleLogout = () => {
    setCurrentStudent(null);
    localStorage.removeItem('routine_user');
  };

  const getSolvedCount = (studentId: number, dateStr: string) => {
    const log = logs.find(l => l.student_id === studentId && l.log_date === dateStr);
    return log ? log.solved_count : 0;
  };

  const getSuccessDaysCount = (studentId: number) => {
    return logs.filter(l => l.student_id === studentId && l.solved_count >= 3).length;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#ffb3c6', fontSize: '1.2rem', fontWeight: 'bold' }}>💖 소중한 루틴 찾아오는 중...</div>;
  }

  if (!currentStudent) {
    return (
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '40px 24px', fontFamily: '"Noto Sans KR", sans-serif', backgroundColor: '#fff5f5', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '3.5rem' }}>🎀</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ff7aa2', letterSpacing: '-0.5px', margin: '12px 0 0 0' }}>Daily Log_</h1>
          <p style={{ color: '#ffa6c9', fontSize: '0.95rem', marginTop: '6px', fontWeight: '500' }}>오늘도 반짝이는 하루를 채워볼까요?</p>
        </div>
        
        <div style={{ backgroundColor: '#ffffff', padding: '32px 24px', borderRadius: '24px', boxShadow: '0 12px 32px rgba(255, 182, 198, 0.15)' }}>
          {!isRegisterMode ? (
            <form onSubmit={handleLoginSubmit}>
              <h3 style={{ marginBottom: '20px', color: '#ff94b4', fontSize: '1rem', fontWeight: '700', textAlign: 'center' }}>🧁 로그인을 해주세요</h3>
              <input 
                type="text" 
                placeholder="이름을 입력하세요" 
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                style={{ width: '100%', padding: '16px', border: '1px solid #ffe3e8', borderRadius: '14px', backgroundColor: '#fff8f9', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '16px', color: '#555' }}
              />
              <button type="submit" style={{ width: '100%', padding: '16px', backgroundColor: '#ff7aa2', border: 'none', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '700', color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,122,162,0.2)' }}>
                입장하기 ✨
              </button>
              <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: '#aaa' }}>
                처음 왔나요?{' '}
                <span onClick={() => setIsRegisterMode(true)} style={{ color: '#ff7aa2', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                  회원가입하기
                </span>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit}>
              <h3 style={{ marginBottom: '20px', color: '#ff94b4', fontSize: '1rem', fontWeight: '700', textAlign: 'center' }}>🍰 새로 가입할 이름 적기</h3>
              <input 
                type="text" 
                placeholder="사용할 이름 입력" 
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                style={{ width: '100%', padding: '16px', border: '1px solid #ffe3e8', borderRadius: '14px', backgroundColor: '#fff8f9', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '16px', color: '#555' }}
              />
              <button type="submit" style={{ width: '100%', padding: '16px', backgroundColor: '#ff94b4', border: 'none', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '700', color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,148,180,0.15)' }}>
                가입 완료하기 🌸
              </button>
              <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: '#aaa' }}>
                이미 계정이 있나요?{' '}
                <span onClick={() => setIsRegisterMode(false)} style={{ color: '#ff7aa2', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                  로그인하러 가기
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '32px 20px 60px 20px', fontFamily: '"Noto Sans KR", sans-serif', backgroundColor: '#fffdfd', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px dashed #ffe3e8' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#ff7aa2' }}>🍰 {currentStudent.name}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#ff94b4', fontWeight: '600' }}>이번 달 달성률 ✨ <span style={{ color: '#ff4d7d', fontSize: '1rem' }}>{getSuccessDaysCount(currentStudent.id)}개</span></p>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 14px', backgroundColor: '#fff0f3', color: '#ff7aa2', border: '1px solid #ffe3e8', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' }}>로그아웃</button>
      </div>

      <div style={{ display: 'flex', backgroundColor: '#fff0f3', padding: '5px', borderRadius: '16px', marginBottom: '28px', border: '1px solid #ffe3e8' }}>
        <button onClick={() => setActiveTab('my')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', backgroundColor: activeTab === 'my' ? '#ff7aa2' : 'transparent', color: activeTab === 'my' ? 'white' : '#ff94b4', boxShadow: activeTab === 'my' ? '0 4px 12px rgba(255,122,162,0.2)' : 'none' }}>
          내 캘린더
        </button>
        <button onClick={() => setActiveTab('all')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', backgroundColor: activeTab === 'all' ? '#ff7aa2' : 'transparent', color: activeTab === 'all' ? 'white' : '#ff94b4', boxShadow: activeTab === 'all' ? '0 4px 12px rgba(255,122,162,0.2)' : 'none' }}>
          우리반 다이어리 👥
        </button>
      </div>

      {activeTab === 'my' && (
        <div style={{ padding: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', justifyItems: 'center' }}>
            {weekdays.map(d => {
              const count = getSolvedCount(currentStudent.id, d);
              const isDone = count >= 3;
              return (
                <div 
                  key={d} 
                  title={d}
                  style={{ 
                    width: '58px', 
                    height: '58px', 
                    borderRadius: '18px', 
                    backgroundColor: isDone ? '#ff7aa2' : '#fdf3f5', 
                    border: isDone ? 'none' : '2px dashed #ffd0da',
                    boxShadow: isDone ? '0 6px 14px rgba(255,122,162,0.3)' : 'none',
                    cursor: 'pointer'
                  }} 
                />
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {students.map(s => {
            const isMe = s.id === currentStudent.id;
            return (
              <div key={s.id} style={{ backgroundColor: isMe ? '#fff9fa' : 'white', border: isMe ? '2px solid #ffb3c6' : '1px solid #f9ebed', borderRadius: '20px', padding: '16px', boxShadow: '0 4px 12px rgba(255,182,198,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '800', color: isMe ? '#ff4d7d' : '#555', fontSize: '0.95rem' }}>
                    🎀 {s.name} {isMe && <span style={{ fontSize: '0.75rem', color: 'white', backgroundColor: '#ff7aa2', padding: '2px 8px', borderRadius: '20px', marginLeft: '4px' }}>나</span>}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#ff7aa2', fontWeight: '700', backgroundColor: '#fff0f3', padding: '4px 10px', borderRadius: '12px' }}>✨ {getSuccessDaysCount(s.id)}회</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {weekdays.map(d => {
                    const count = getSolvedCount(s.id, d);
                    const isDone = count >= 3;
                    return (
                      <div 
                        key={d} 
                        title={`${s.name}: ${d}`}
                        style={{ 
                          height: '26px', 
                          borderRadius: '8px', 
                          backgroundColor: isDone ? '#ff94b4' : '#fff8f9',
                          border: isDone ? 'none' : '1px solid #ffe3e8',
                          boxShadow: isDone ? '0 2px 6px rgba(255,148,180,0.2)' : 'none'
                        }} 
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}