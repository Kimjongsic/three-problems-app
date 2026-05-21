import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css'; 

// 페들릿 주소를 넣어주세요.
const PADLET_URL = "https://padlet.com"; 

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
  const [myCalendarView, setMyCalendarView] = useState<'month' | 'year'>('month');

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

  const getEmptyBlocksCount = (year: number, month: number): number => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    if (firstDay === 0 || firstDay === 6) return 0;
    return firstDay - 1;
  };

  const weekdays = getWeekdaysOfMonth(currentYear, currentMonth);

  const fetchData = async (showGlobalLoading = false) => {
    if (showGlobalLoading) setLoading(true);
    
    const { data: studentData } = await supabase.from('students').select('*').order('id', { ascending: true });
    
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;
    
    const { data: logData } = await supabase
      .from('challenge_logs')
      .select('student_id, log_date, solved_count')
      .gte('log_date', startDate)
      .lte('log_date', endDate);

    if (studentData) setStudents(studentData);
    if (logData) setLogs(logData);
    
    if (showGlobalLoading) setLoading(false);
  };

  useEffect(() => {
    const isInitialLoad = students.length === 0;
    fetchData(isInitialLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear]); 

  useEffect(() => {
    const subscription = supabase
      .channel('challenge_logs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenge_logs' },
        () => {
          fetchData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear]);

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
      setMyCalendarView('month');
      setLoginPin('');
      localStorage.setItem('routine_user', JSON.stringify(student));
    } else {
      alert('비밀번호가 맞지 않아요. 다시 한 번 확인해 주세요! 🥲');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim() || !registerPin.trim()) return;

    if (registerPin.trim().length !== 4 || isNaN(Number(registerPin))) {
      alert('비밀번호는 꼭 4자리 숫자로 설정해 주세요!');
      return;
    }

    const isNameExist = students.some(s => s.name === registerName.trim());
    if (isNameExist) {
      alert('이미 친구가 사용 중인 이름이에요. 다른 이름을 써주세요 🥺');
      return;
    }

    const isPinExist = students.some(s => s.password_pin === registerPin.trim());
    if (isPinExist) {
      alert('앗, 이미 다른 친구가 쓰는 비밀번호네요! 나만의 숫자를 다시 정해볼까요? 🍀');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .insert([{ name: registerName.trim(), password_pin: registerPin.trim() }])
      .select();

    if (!error && data && data.length > 0) {
      alert('다이어리 등록 완료! 이제 내가 설정한 비밀번호로 로그인해 보세요 🤍');
      setRegisterName('');
      setRegisterPin('');
      setIsRegisterMode(false);
      fetchData(false);
    } else {
      alert('등록 중 작은 오류가 발생했어요. 다시 시도해 주세요.');
    }
  };

  const handleSquareClick = async (dateStr: string) => {
    if (!currentStudent) return;

    if (dateStr !== todayStr) {
      alert('오늘 날짜의 루틴만 예쁘게 채울 수 있어요! ✍️');
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
      alert('저장에 실패했어요. 인터넷 연결을 확인해 주세요!');
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

  const getSuccessDaysCountByMonth = (studentId: number, year: number, month: number) => {
    return logs.filter(l => {
      if (l.student_id !== studentId || l.solved_count < 3) return false;
      const logDate = new Date(l.log_date);
      return logDate.getFullYear() === year && (logDate.getMonth() + 1) === month;
    }).length;
  };

  const getSuccessDaysCount = (studentId: number) => {
    return getSuccessDaysCountByMonth(studentId, currentYear, currentMonth);
  };

  const getSuccessDaysCountByYear = (studentId: number, year: number) => {
    return logs.filter(l => {
      if (l.student_id !== studentId || l.solved_count < 3) return false;
      const logDate = new Date(l.log_date);
      return logDate.getFullYear() === year;
    }).length;
  };

  if (loading && students.length === 0) {
    return <div className="loading-screen">예쁜 다이어리를 불러오는 중... 🤍</div>;
  }

  if (!currentStudent) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-emoji">📚</div>
          <h1 className="auth-title">Study Tracker</h1>
          <p className="auth-subtitle">매일 조금씩 성장하는 우리들의 기록 🍀</p>
        </div>
        
        <div className="auth-card">
          {!isRegisterMode ? (
            <form onSubmit={handleLoginSubmit}>
              <h3 className="auth-form-title">내 플래너 열기</h3>
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="내 PIN 번호 (4자리)" 
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                className="auth-input pin"
              />
              <button type="submit" className="auth-button">
                입장하기 🤍
              </button>
              <p className="auth-switch-text">
                아직 플래너가 없나요?{' '}
                <span onClick={() => setIsRegisterMode(true)} className="auth-switch-link">
                  새로운 기록 시작하기
                </span>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit}>
              <h3 className="auth-form-title">나만의 플래너 만들기</h3>
              <input 
                type="text" 
                placeholder="이름을 예쁘게 적어주세요" 
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                className="auth-input"
              />
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="나만의 PIN 번호 (숫자 4자리)" 
                value={registerPin}
                onChange={e => setRegisterPin(e.target.value)}
                className="auth-input pin"
              />
              <button type="submit" className="auth-button" style={{ backgroundColor: '#f472b6' }}>
                만들기 완료 ✨
              </button>
              <p className="auth-switch-text">
                이미 만들었나요?{' '}
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

  return (
    <div className="dashboard-container">
      
      <div className="dashboard-header">
        <div className="header-top">
          <h2 className="student-name">🎧 {currentStudent.name} 님</h2>
          <button onClick={handleLogout} className="logout-button">로그아웃</button>
        </div>

        <div className="month-selector">
          <button onClick={handlePrevMonth} className="month-btn" aria-label="이전 달">◀</button>
          <div className="month-info">
            <span className="month-title">{currentYear}년 {currentMonth}월</span>
            <span className="month-subtitle">
              이번 달 채운 날 <span className="highlight-count">{getSuccessDaysCount(currentStudent.id)}일</span>
            </span>
          </div>
          <button onClick={handleNextMonth} className="month-btn" aria-label="다음 달">▶</button>
        </div>
      </div>

      <div className="tabs-wrapper">
        <button 
          onClick={() => setActiveTab('my')} 
          className={`tab-button ${activeTab === 'my' ? 'active' : ''}`}
        >
          마이 캘린더
        </button>
        <button 
          onClick={() => setActiveTab('all')} 
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
        >
          우리 반 스터디 로그 🎧
        </button>
      </div>

      {activeTab === 'my' && (
        <div className="calendar-section">
          <div className="view-toggle-wrapper">
            <button 
              className={`view-toggle-btn ${myCalendarView === 'month' ? 'active' : ''}`} 
              onClick={() => setMyCalendarView('month')}
            >
              한 달 보기
            </button>
            <button 
              className={`view-toggle-btn ${myCalendarView === 'year' ? 'active' : ''}`} 
              onClick={() => setMyCalendarView('year')}
            >
              1년 모아보기
            </button>
          </div>

          {myCalendarView === 'month' ? (
            <>
              <p className="calendar-guide">오늘 칸을 꾹 눌러서 나의 하루를 예쁘게 색칠해 보세요 🎨</p>
              
              <div className="padlet-btn-wrapper">
                <a 
                  href={PADLET_URL} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="padlet-link-btn"
                >
                  📸 오늘의 미션 인증하러 가기
                </a>
              </div>

              <div className="calendar-grid">
                {Array.from({ length: getEmptyBlocksCount(currentYear, currentMonth) }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="empty-block" />
                ))}
                
                {weekdays.map(d => {
                  const count = getSolvedCount(currentStudent.id, d);
                  const isDone = count >= 3;
                  const isToday = d === todayStr;
                  const dayNum = Number(d.split('-')[2]); 

                  return (
                    <div 
                      key={d} 
                      title={isToday ? "오늘 날짜 🎯" : d}
                      onClick={() => handleSquareClick(d)} 
                      className={`day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="yearly-view-container">
              <div className="yearly-total-score">
                ✨ {currentYear}년 나의 성장 기록: <span className="highlight-count">{getSuccessDaysCountByYear(currentStudent.id, currentYear)}일</span>
              </div>
              <div className="yearly-grid">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const monthWeekdays = getWeekdaysOfMonth(currentYear, month);
                  const emptyCount = getEmptyBlocksCount(currentYear, month);
                  const monthSuccessCount = getSuccessDaysCountByMonth(currentStudent.id, currentYear, month);
                  
                  return (
                    <div key={month} className="yearly-month-card">
                      <div className="yearly-month-header">
                        <h4 className="yearly-month-title">{month}월</h4>
                        <span className="yearly-month-score">✓ {monthSuccessCount}일</span>
                      </div>
                      <div className="small-calendar-grid">
                        {Array.from({ length: emptyCount }).map((_, idx) => (
                          <div key={`empty-yr-${month}-${idx}`} className="small-empty-block" />
                        ))}
                        {monthWeekdays.map(d => {
                          const count = getSolvedCount(currentStudent.id, d);
                          const isDone = count >= 3;
                          const isToday = d === todayStr;
                          const dayNum = Number(d.split('-')[2]); 

                          return (
                            <div 
                              key={d} 
                              title={d}
                              onClick={() => handleSquareClick(d)}
                              className={`small-day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}`}
                              style={{ cursor: isToday ? 'pointer' : 'default' }}
                            >
                              {dayNum}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'all' && (
        <div className="all-board-list">
          {[...students]
            .sort((a, b) => a.name.localeCompare(b.name, 'ko')) 
            .map(s => {
              const isMe = s.id === currentStudent.id;
              const emptyCount = getEmptyBlocksCount(currentYear, currentMonth);
              return (
                <div key={s.id} className={`student-card ${isMe ? 'me' : ''}`}>
                  <div className="student-card-header">
                    <span className="student-card-name" title={s.name}>
                      {s.name} {isMe && <span className="me-badge">Me</span>}
                    </span>
                    <span className="student-card-score">✓ {getSuccessDaysCount(s.id)}일</span>
                  </div>
                  
                  <div className="small-calendar-grid">
                    {Array.from({ length: emptyCount }).map((_, idx) => (
                      <div key={`empty-all-${s.id}-${idx}`} className="small-empty-block" />
                    ))}
                    {weekdays.map(d => {
                      const count = getSolvedCount(s.id, d);
                      const isDone = count >= 3;
                      const isToday = d === todayStr;
                      const dayNum = Number(d.split('-')[2]); 

                      return (
                        <div 
                          key={d} 
                          title={`${s.name}: ${d}`}
                          className={`small-day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}`}
                        >
                          {dayNum}
                        </div>
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