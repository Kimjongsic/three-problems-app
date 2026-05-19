import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Student {
  id: number;
  name: string;
}

// 1. TypeScript 타입 에러 수정을 위해 problem_titles 속성 추가
interface ChallengeLog {
  student_id: number;
  log_date: string;
  solved_count: number;
  problem_titles?: string[]; 
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<ChallengeLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 로그인된 학생 상태 (null이면 로그인 화면)
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  // 탭 상태: 'my' (내 홈화면), 'all' (전체 현황판)
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  
  // 입력 창 상태
  const [inputValue, setInputValue] = useState('');

  const YEAR = 2026;
  const MONTH = 5;
  const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

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
    const { data: logData } = await supabase.from('challenge_logs').select('*').gte('log_date', startDate).lte('log_date', endDate);

    if (studentData) setStudents(studentData);
    if (logData) setLogs(logData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // 로컬 스토리지에서 자동 로그인 정보 확인
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

  // 문제 추가 로직
  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent || !inputValue.trim()) return;

    const existingLog = logs.find(l => l.student_id === currentStudent.id && l.log_date === todayStr);
    const currentCount = existingLog ? existingLog.solved_count : 0;
    
    if (currentCount >= 3) {
      alert('오늘 목표인 3문제를 이미 달성했어요! 🎉');
      return;
    }

    const nextCount = currentCount + 1;
    const currentTitles = existingLog?.problem_titles || [];
    const nextTitles = [...currentTitles, inputValue.trim()];

    const { error } = await supabase.from('challenge_logs').upsert({
      student_id: currentStudent.id,
      log_date: todayStr,
      solved_count: nextCount,
      problem_titles: nextTitles
    }, { onConflict: 'student_id, log_date' });

    if (!error) {
      setInputValue('');
      fetchData(); // 화면 갱신
    }
  };

  const getSolvedCount = (studentId: number, dateStr: string) => {
    const log = logs.find(l => l.student_id === studentId && l.log_date === dateStr);
    return log ? log.solved_count : 0;
  };

  // 통계 계산 (이번 달 성공한 총 일수)
  const getSuccessDaysCount = (studentId: number) => {
    return logs.filter(l => l.student_id === studentId && l.solved_count >= 3).length;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>💡 데일리 루틴 불러오는 중...</div>;
  }

  // [1] 로그인 안 되어 있을 때: 학생 선택 화면
  if (!currentStudent) {
    return (
      <div style={{ maxWidth: '450px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '3rem' }}>📆</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1a1d20', marginTop: '10px' }}>Daily 3 Problems</h1>
          <p style={{ color: '#868e96', fontSize: '0.95rem' }}>오늘도 나의 루틴을 채워볼까요?</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginBottom: '16px', color: '#495057', fontSize: '1rem' }}>이름을 선택해 주세요</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {students.map(s => (
              <button key={s.id} onClick={() => handleLogin(s)} style={{ padding: '16px', backgroundColor: '#f1f3f5', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', color: '#343a40', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}>
                👤 {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // [2] 로그인 완료 상태: 메인 화면 (모바일 뷰)
  const myTodayCount = getSolvedCount(currentStudent.id, todayStr);

  return (
    <div style={{ maxWidth: '450px', margin: '0 auto', padding: '0 0 80px 0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#fafbfc', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* 상단 프로필 헤더 */}
      <div style={{ backgroundColor: '#1e222b', color: 'white', padding: '30px 24px 20px 24px', borderRadius: '0 0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#aaafb9', fontWeight: '500' }}>{YEAR}년 {MONTH}월</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '700' }}>{currentStudent.name} 님의 홈</h2>
          </div>
          <button onClick={handleLogout} style={{ padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#eee', border: 'none', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer' }}>로그아웃</button>
        </div>

        {/* 상단 요약 미니 카드 */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', padding: '14px', borderRadius: '14px' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaafb9' }}>이번 달 성공 일수</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: '700', color: '#4CAF50' }}>🔥 {getSuccessDaysCount(currentStudent.id)}일</p>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', padding: '14px', borderRadius: '14px' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaafb9' }}>오늘 챌린지</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: '700' }}>{myTodayCount} / 3</p>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div style={{ padding: '20px 16px' }}>
        
        {/* 2. 중복 스타일 에러 수정을 위해 한 개의 backgroundColor만 남김 */}
        <div style={{ display: 'flex', padding: '4px', borderRadius: '12px', marginBottom: '20px', backgroundColor: '#f1f3f5' }}>
          <button onClick={() => setActiveTab('my')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', backgroundColor: activeTab === 'my' ? 'white' : 'transparent', color: activeTab === 'my' ? '#111' : '#868e96', boxShadow: activeTab === 'my' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
            내 루틴 보드
          </button>
          <button onClick={() => setActiveTab('all')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', backgroundColor: activeTab === 'all' ? 'white' : 'transparent', color: activeTab === 'all' ? '#111' : '#868e96', boxShadow: activeTab === 'all' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
            친구들 현황판 👥
          </button>
        </div>

        {/* 탭 1: 내 홈화면 */}
        {activeTab === 'my' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 오늘 문제 입력창 카드 */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '18px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#333' }}>🎯 오늘 푼 문제 기록</h3>
              {myTodayCount < 3 ? (
                <form onSubmit={handleAddProblem} style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="문제 제목을 적어주세요" value={inputValue} onChange={e => setInputValue(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e9ecef', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8f9fa' }} />
                  <button type="submit" style={{ padding: '0 16px', backgroundColor: '#1e222b', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}>등록</button>
                </form>
              ) : (
                <div style={{ padding: '12px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>🎉 오늘 해야 할 최고치 달성! 대단해요!</div>
              )}
            </div>

            {/* 내 사각형 트래커 보드 */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '18px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#333' }}>🗓️ 나의 월간 루틴 보드</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', justifyItems: 'center' }}>
                {weekdays.map(d => {
                  const count = getSolvedCount(currentStudent.id, d);
                  const isToday = d === todayStr;
                  return (
                    <div key={d} title={d} style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: count >= 3 ? '#4CAF50' : count > 0 ? '#a5d6a7' : '#e9ecef', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', border: isToday ? '2px solid #1e222b' : 'none' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: count > 0 ? 'white' : '#495057' }}>{d.split('-')[2]}</span>
                      {count > 0 && count < 3 && <span style={{ fontSize: '0.6rem', color: 'white' }}>({count}/3)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 탭 2: 전체 학생 현황판 */}
        {activeTab === 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {students.map(s => (
              <div key={s.id} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.01)', border: s.id === currentStudent.id ? '1.5px solid #4CAF50' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#333', fontSize: '0.95rem' }}>👤 {s.name} {s.id === currentStudent.id && <span style={{ fontSize: '0.75rem', color: '#4CAF50', backgroundColor: '#e8f5e9', padding: '2px 6px', borderRadius: '4px' }}>나</span>}</span>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>성공 <b>{getSuccessDaysCount(s.id)}회</b></span>
                </div>
                {/* 압축형 5열 그리드 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {weekdays.map(d => {
                    const count = getSolvedCount(s.id, d);
                    return (
                      <div key={d} title={`${s.name}: ${d}`} style={{ height: '24px', borderRadius: '6px', backgroundColor: count >= 3 ? '#4CAF50' : count > 0 ? '#a5d6a7' : '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: count > 0 ? 'white' : '#aaa', fontWeight: 'bold' }}>
                        {d.split('-')[2]}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}