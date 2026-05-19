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
  
  // 로그인 및 탭 상태 관리
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');

  const YEAR = 2026;
  const MONTH = 5;

  // 이번 달 평일(월~금) 리스트 구하기
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

  const handleLogin = (student: Student) => {
    setCurrentStudent(student);
    setActiveTab('my');
    localStorage.setItem('routine_user', JSON.stringify(student));
  };

  const handleLogout = () => {
    setCurrentStudent(null);
    localStorage.removeItem('routine_user');
  };

  const getSolvedCount = (studentId: number, dateStr: string) => {
    const log = logs.find(l => l.student_id === studentId && l.log_date === dateStr);
    return log ? log.solved_count : 0;
  };

  // 이번 달 성공 횟수 (3문제 이상 푼 날의 총합)
  const getSuccessDaysCount = (studentId: number) => {
    return logs.filter(l => l.student_id === studentId && l.solved_count >= 3).length;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#999' }}>로딩 중...</div>;
  }

  // [1] 로그인 전: 이름 선택 화면
  if (!currentStudent) {
    return (
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#222', letterSpacing: '-0.5px' }}>루틴 체크인</h1>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '4px' }}>본인의 이름을 선택하세요</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {students.map(s => (
            <button key={s.id} onClick={() => handleLogin(s)} style={{ padding: '18px', backgroundColor: '#f5f6f7', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: '600', color: '#333', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // [2] 로그인 후: 메인 대시보드
  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px 60px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: '#fff', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* 심플 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111' }}>{currentStudent.name}</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#999' }}>이번 달 성공: <span style={{ color: '#2E7D32', fontWeight: 'bold' }}>{getSuccessDaysCount(currentStudent.id)}회</span></p>
        </div>
        <button onClick={handleLogout} style={{ padding: '6px 12px', backgroundColor: '#f5f6f7', color: '#777', border: 'none', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>로그아웃</button>
      </div>

      {/* 심플 탭 내비게이션 */}
      <div style={{ display: 'flex', backgroundColor: '#f5f6f7', padding: '3px', borderRadius: '10px', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('my')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '7px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', backgroundColor: activeTab === 'my' ? 'white' : 'transparent', color: activeTab === 'my' ? '#111' : '#aaa', boxShadow: activeTab === 'my' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none' }}>
          내 보드
        </button>
        <button onClick={() => setActiveTab('all')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '7px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', backgroundColor: activeTab === 'all' ? 'white' : 'transparent', color: activeTab === 'all' ? '#111' : '#aaa', boxShadow: activeTab === 'all' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none' }}>
          전체 보기
        </button>
      </div>

      {/* 탭 1: 내 보드 (숫자 없는 순수 사각형) */}
      {activeTab === 'my' && (
        <div style={{ padding: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', justifyItems: 'center' }}>
            {weekdays.map(d => {
              const count = getSolvedCount(currentStudent.id, d);
              return (
                <div 
                  key={d} 
                  title={d} // 마우스를 올리면 날짜가 보입니다
                  style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '14px', 
                    backgroundColor: count >= 3 ? '#4CAF50' : '#f0f0f0', 
                    transition: 'background-color 0.2s ease'
                  }} 
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 2: 전체 보기 (모든 학생 리스트) */}
      {activeTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {students.map(s => (
            <div key={s.id} style={{ borderBottom: '1px solid #f9f9f9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: s.id === currentStudent.id ? '#111' : '#555', fontSize: '0.9rem' }}>
                  {s.name} {s.id === currentStudent.id && <span style={{ fontSize: '0.7rem', color: '#4CAF50', marginLeft: '4px' }}>(나)</span>}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>{getSuccessDaysCount(s.id)}회</span>
              </div>
              
              {/* 친구들 보드 (더 압축된 숫자 없는 사각형) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {weekdays.map(d => {
                  const count = getSolvedCount(s.id, d);
                  return (
                    <div 
                      key={d} 
                      title={`${s.name}: ${d}`}
                      style={{ 
                        height: '24px', 
                        borderRadius: '6px', 
                        backgroundColor: count >= 3 ? '#4CAF50' : '#f5f5f5' 
                      }} 
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}