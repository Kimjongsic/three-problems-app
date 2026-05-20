import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css'; 

interface Student {
  id: number;
  name: string;
  password_pin: string;
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
  
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [loginPin, setLoginPin] = useState(''); 
  const [registerName, setRegisterName] = useState('');
  const [registerPin, setRegisterPin] = useState(''); 
  
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');

  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5);

  const getTodayStr = () => {
    const now = new Date();
    const krOffset = 9 * 60 * 60 * 1000; 
    const krDate = new Date(now.getTime() + krOffset);
    return krDate.toISOString().split('T')[0];
  };
  const todayStr = getTodayStr();

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

  const weekdays = getWeekdaysOfMonth(currentYear, currentMonth);

  const fetchData = async (showGlobalLoading = false) => {
    if (showGlobalLoading) setLoading(true);
    
    const { data: studentData } = await supabase.from('students').select('*').order('id', { ascending: true });
    
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;
    
    const { data: logData } = await supabase
      .from('challenge_logs')
      .select('student_id, log_date, solved_count')
      .gte('log_date', startDate)
      .lte('log_date', endDate);

    if (studentData) setStudents(studentData);
    if (logData) setLogs(logData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData(true);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    const savedUser = localStorage.getItem('routine_user');
    if (savedUser) setCurrentStudent(JSON.parse(savedUser));
  }, []);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPin.trim()) return;

    const student = students.find(s => s.password_pin === loginPin.trim());
    
    if (student) {
      setCurrentStudent(student);
      setActiveTab('my');
      setLoginPin('');
      localStorage.setItem('routine_user', JSON.stringify(student));
    } else {
      alert('비밀번호가 일치하는 학생이 없어요. 다시 확인해 주세요! 🎀');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim() || !registerPin.trim()) return;

    if (registerPin.trim().length !== 4 || isNaN(Number(registerPin))) {
      alert('비밀번호는 숫자 4자리로 설정해 주세요! 🧁');
      return;
    }

    const isNameExist = students.some(s => s.name === registerName.trim());
    if (isNameExist) {
      alert('이미 등록된 이름이에요! 다른 이름을 사용해 주세요. 🍰');
      return;
    }

    const isPinExist = students.some(s => s.password_pin === registerPin.trim());
    if (isPinExist) {
      alert('이미 다른 친구가 사용 중인 비밀번호예요! 나만의 비밀번호 4자리를 정해주세요. ⭐');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .insert([{ name: registerName.trim(), password_pin: registerPin.trim() }])
      .select();

    if (!error && data && data.length > 0) {
      alert('가입이 완료되었어요! 방금 정한 비밀번호로 로그인해 주세요. 💕');
      setRegisterName('');
      setRegisterPin('');
      setIsRegisterMode(false);
      fetchData(false);
    } else {
      alert('회원가입 중 오류가 발생했어요.');
    }
  };

  const handleSquareClick = async (dateStr: string) => {
    if (!currentStudent) return;

    if (dateStr !== todayStr) {
      alert('오늘 날짜의 루틴만 체크할 수 있어요! 🗓️');
      return;
    }

    const currentCount = getSolvedCount(currentStudent.id, dateStr);
    const nextCount = currentCount >= 3 ? 0 : 3;

    const updatedLogs = [...logs];
    const logIndex = updatedLogs.findIndex(l => l.student_id === currentStudent.id && l.log_date === dateStr);
    
    if (logIndex > -1) {
      updatedLogs[logIndex].solved_count = nextCount;
    } else {
      updatedLogs.push({ student_id: currentStudent.id, log_date: dateStr, solved_count: nextCount });
    }
    setLogs(updatedLogs);

    const { error } = await supabase
      .from('challenge_logs')
      .upsert({
        student_id: currentStudent.id,
        log_date: dateStr,
        solved_count: nextCount
      }, { onConflict: 'student_id, log_date' });

    if (error) {
      alert('저장에 실패했습니다. 다시 시도해 주세요.');
      fetchData(false);
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
    return <div className="loading-screen">💖 소중한 루틴 찾아오는 중...</div>;
  }

  // [1] 로그인 / 회원가입 화면
  if (!currentStudent) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-emoji">🎀</span>
          <h1 className="auth-title">Daily Log_</h1>
          <p className="auth-subtitle">오늘도 반짝이는 하루를 채워볼까요?</p>
        </div>
        
        <div className="auth-card">
          {!isRegisterMode ? (
            <form onSubmit={handleLoginSubmit}>
              <h3 className="auth-form-title">🧁 비밀번호 입력하기</h3>
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="비밀번호 숫자 4자리" 
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                className="auth-input pin"
              />
              <button type="submit" className="auth-button">
                열기 ✨
              </button>
              <p className="auth-switch-text">
                처음 왔나요?{' '}
                <span onClick={() => setIsRegisterMode(true)} className="auth-switch-link">
                  나만의 다이어리 만들기
                </span>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit}>
              <h3 className="auth-form-title">🍰 내 다이어리 등록</h3>
              <input 
                type="text" 
                placeholder="이름을 입력하세요" 
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                className="auth-input"
              />
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="비밀번호 숫자 4자리" 
                value={registerPin}
                onChange={e => setRegisterPin(e.target.value)}
                className="auth-input pin"
              />
              <button type="submit" className="auth-button" style={{ backgroundColor: '#ff94b4' }}>
                만들기 완료하기 🌸
              </button>
              <p className="auth-switch-text">
                이미 계정이 있나요?{' '}
                <span onClick={() => setIsRegisterMode(false)} className="auth-switch-link">
                  로그인하러 가기
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // [2] 로그인 후 메인 대시보드 화면
  return (
    <div className="dashboard-container">
      
      {/* 상단 헤더 및 월 선택 네비게이터 바 */}
      <div className="dashboard-header">
        <div className="header-top">
          <h2 className="student-name">🍰 {currentStudent.name}</h2>
          <button onClick={handleLogout} className="logout-button">로그아웃</button>
        </div>

        <div className="month-selector">
          <button onClick={handlePrevMonth} className="month-btn">◀</button>
          <div className="month-info">
            <span className="month-title">{currentYear}년 {currentMonth}월</span>
            <span className="month-subtitle">
              달성 횟수 ✨ <span className="highlight-count">{getSuccessDaysCount(currentStudent.id)}회</span>
            </span>
          </div>
          <button onClick={handleNextMonth} className="month-btn">▶</button>
        </div>
      </div>

      {/* 탭 버튼 */}
      <div className="tabs-wrapper">
        <button 
          onClick={() => setActiveTab('my')} 
          className={`tab-button ${activeTab === 'my' ? 'active' : ''}`}
        >
          내 캘린더
        </button>
        <button 
          onClick={() => setActiveTab('all')} 
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
        >
          우리반 다이어리 👥
        </button>
      </div>

      {/* 탭 1: 내 보드 */}
      {activeTab === 'my' && (
        <div style={{ padding: '4px' }}>
          <p className="calendar-guide">🎀 오늘 날짜의 마카롱을 누르면 불이 켜져요! 🎀</p>
          <div className="calendar-grid">
            {weekdays.map(d => {
              const count = getSolvedCount(currentStudent.id, d);
              const isDone = count >= 3;
              const isToday = d === todayStr;

              return (
                <div 
                  key={d} 
                  title={isToday ? "오늘 날짜 🎯" : d}
                  onClick={() => handleSquareClick(d)} 
                  className={`day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 2: 전체 보기 */}
      {activeTab === 'all' && (
        <div className="all-board-list">
          {students.map(s => {
            const isMe = s.id === currentStudent.id;
            return (
              <div key={s.id} className={`student-card ${isMe ? 'me' : ''}`}>
                <div className="student-card-header">
                  <span className="student-card-name">
                    🎀 {s.name} {isMe && <span className="me-badge">나</span>}
                  </span>
                  <span className="student-card-score">✨ {getSuccessDaysCount(s.id)}회</span>
                </div>
                
                <div className="small-calendar-grid">
                  {weekdays.map(d => {
                    const count = getSolvedCount(s.id, d);
                    const isDone = count >= 3;
                    const isToday = d === todayStr;

                    return (
                      <div 
                        key={d} 
                        title={`${s.name}: ${d}`}
                        className={`small-day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}`}
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