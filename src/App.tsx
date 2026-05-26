import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css'; 

const PADLET_URL = "https://padlet.com/whdtlr8279_2/3-16pkfrpo9muwf4px";

// 💡 수정됨: 관리자 비밀번호를 "admin"으로 변경했습니다.
const ADMIN_PASSWORD = "admin"; 

const EMOJI_LIST = ['🤍', '❤️', '🐰', '🍀', '🍒', '🐥', '🧸', '🎀', '🎧', '🌙'];

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
  
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'admin'>('login');
  const [loginName, setLoginName] = useState(''); // 👈 새로 추가된 부분
  const [loginPin, setLoginPin] = useState(''); 
  const [registerName, setRegisterName] = useState('');
  const [registerPin, setRegisterPin] = useState(''); 
  
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSelectedStudentId, setAdminSelectedStudentId] = useState<number | null>(null);
  
  const [userEmoji, setUserEmoji] = useState('🤍'); 
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  
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
    if (isAdmin && students.length > 0 && !adminSelectedStudentId) {
      setAdminSelectedStudentId(students[0].id);
    }
  }, [isAdmin, students, adminSelectedStudentId]);

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
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setCurrentStudent(parsedUser);
      const savedEmoji = localStorage.getItem(`emoji_${parsedUser.id}`);
      if (savedEmoji) setUserEmoji(savedEmoji);
    }

    const savedAdmin = localStorage.getItem('routine_admin');
    if (savedAdmin === 'true') {
      setIsAdmin(true);
    }
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

  const toggleEmojiPicker = () => {
    setIsEmojiPickerOpen(!isEmojiPickerOpen);
  };

  const selectEmoji = (emoji: string) => {
    if (!currentStudent) return;
    setUserEmoji(emoji);
    localStorage.setItem(`emoji_${currentStudent.id}`, emoji);
    setIsEmojiPickerOpen(false); 
  };

  const switchAuthMode = (mode: 'login' | 'register' | 'admin') => {
    setAuthMode(mode);
    setLoginPin(''); // 모드 전환 시 입력하던 핀번호 초기화
    setLoginName(''); // 👈 새로 추가된 부분
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (authMode === 'admin') {
      if (!loginPin.trim()) return;
      if (loginPin === ADMIN_PASSWORD) {
        setIsAdmin(true);
        setLoginPin('');
        localStorage.setItem('routine_admin', 'true');
      } else {
        alert('관리자 비밀번호가 올바르지 않습니다.');
      }
      return;
    }

    // 👈 학생 로그인 검증 로직 변경 시작
    if (!loginName.trim() || !loginPin.trim()) {
      alert('이름과 비밀번호를 모두 입력해 주세요!');
      return;
    }

    // 이름과 비밀번호가 모두 일치하는 학생 찾기
    const student = students.find(
      s => s.name === loginName.trim() && s.password_pin === loginPin.trim()
    );

    if (student) {
      setCurrentStudent(student);
      setActiveTab('my');
      setMyCalendarView('month');
      setLoginName(''); // 이름 초기화
      setLoginPin('');
      localStorage.setItem('routine_user', JSON.stringify(student));
      
      const savedEmoji = localStorage.getItem(`emoji_${student.id}`);
      setUserEmoji(savedEmoji || '🤍');
    } else {
      alert('이름이나 비밀번호가 맞지 않아요. 다시 한 번 확인해 주세요! 🥲');
    }
    // 👈 변경 끝
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
      alert('등록이 완료되었습니다. 설정한 비밀번호로 로그인해 주세요 🤍');
      setRegisterName('');
      setRegisterPin('');
      setAuthMode('login');
      fetchData(false);
    } else {
      alert('등록 중 작은 오류가 발생했어요. 다시 시도해 주세요.');
    }
  };

  const handleSquareClick = async (dateStr: string, targetStudentId?: number) => {
    const studentIdToUpdate = isAdmin ? targetStudentId : currentStudent?.id;
    if (!studentIdToUpdate) return;

    if (!isAdmin && dateStr !== todayStr) {
      alert('오늘 날짜의 챌린지만 기록할 수 있어요! ✍️');
      return;
    }

    const currentCount = getSolvedCount(studentIdToUpdate, dateStr);
    const nextCount = currentCount >= 3 ? 0 : 3;

    const updatedLogs = [...logs];
    const logIndex = updatedLogs.findIndex(l => l.student_id === studentIdToUpdate && l.log_date === dateStr);
    
    if (logIndex > -1) {
      updatedLogs[logIndex].solved_count = nextCount;
    } else {
      updatedLogs.push({ student_id: studentIdToUpdate, log_date: dateStr, solved_count: nextCount });
    }
    setLogs(updatedLogs);

    const { error } = await supabase
      .from('challenge_logs')
      .upsert({
        student_id: studentIdToUpdate,
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
    setIsAdmin(false);
    setAuthMode('login');
    localStorage.removeItem('routine_user');
    localStorage.removeItem('routine_admin');
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
    return <div className="loading-screen">데이터를 불러오는 중입니다...</div>;
  }

  if (!currentStudent && !isAdmin) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-emoji">📖</div>
          <h1 className="auth-title">Daily Challenge</h1>
          <p className="auth-subtitle">하루 3문제, 꾸준함의 힘을 기록하세요.</p>
        </div>
        
        <div className="auth-card">
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              <h3 className="auth-form-title">학생 로그인</h3>

              {/* 👈 이름 입력란 추가 */}
              <input 
                type="text" 
                placeholder="이름" 
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                className="auth-input"
              />

              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="비밀번호(4자리)" 
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                className="auth-input pin"
              />
              <button type="submit" className="auth-button">로그인하기</button>
              <p className="auth-switch-text">
                처음 방문하셨나요?{' '}
                <span onClick={() => switchAuthMode('register')} className="auth-switch-link">
                  새로운 기록 시작하기
                </span>
              </p>
              <p className="auth-switch-text" style={{ marginTop: '10px' }}>
                <span onClick={() => switchAuthMode('admin')} className="auth-switch-link" style={{ color: '#d8b4fe', fontWeight: '500' }}>
                  선생님이신가요? (관리자 모드)
                </span>
              </p>
            </form>
          )}

          {authMode === 'admin' && (
            <form onSubmit={handleLoginSubmit}>
              <h3 className="auth-form-title">👩‍🏫 관리자(선생님) 로그인</h3>
              {/* 💡 수정됨: maxLength 속성과 pin 클래스를 삭제하여 긴 영문 입력이 자연스럽게 가능하도록 함 */}
              <input 
                type="password" 
                placeholder="관리자 비밀번호" 
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                className="auth-input"
              />
              <button type="submit" className="auth-button" style={{ backgroundColor: '#7c3aed' }}>
                선생님 모드 입장
              </button>
              <p className="auth-switch-text">
                학생이신가요?{' '}
                <span onClick={() => switchAuthMode('login')} className="auth-switch-link">
                  학생 로그인으로 돌아가기
                </span>
              </p>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit}>
              <h3 className="auth-form-title">신규 학생 등록</h3>
              <input 
                type="text" 
                placeholder="이름" 
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                className="auth-input"
              />
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="비밀번호(숫자 4자리)" 
                value={registerPin}
                onChange={e => setRegisterPin(e.target.value)}
                className="auth-input pin"
              />
              <button type="submit" className="auth-button" style={{ backgroundColor: '#f472b6' }}>
                등록 완료
              </button>
              <p className="auth-switch-text">
                이미 등록하셨나요?{' '}
                <span onClick={() => switchAuthMode('login')} className="auth-switch-link">
                  로그인하기
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  const targetId = isAdmin ? adminSelectedStudentId : currentStudent?.id;

  return (
    <div className="dashboard-container">
      
      <div className="dashboard-header">
        <div className="header-top">
          <h2 className="student-name">
            {isAdmin ? (
              <>👩‍🏫 선생님 모드</>
            ) : (
              <>
                <div className="profile-emoji-container">
                  <span className="profile-emoji" onClick={toggleEmojiPicker} title="나만의 이모지를 골라보세요!">
                    {userEmoji}
                  </span>
                  {isEmojiPickerOpen && (
                    <div className="emoji-picker">
                      {EMOJI_LIST.map(emoji => (
                        <span key={emoji} className="picker-emoji" onClick={() => selectEmoji(emoji)}>
                          {emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {currentStudent?.name} 님
              </>
            )}
          </h2>
          <button onClick={handleLogout} className="logout-button">로그아웃</button>
        </div>

        <div className="month-selector">
          <button onClick={handlePrevMonth} className="month-btn" aria-label="이전 달">◀</button>
          <div className="month-info">
            <span className="month-title">{currentYear}년 {currentMonth}월</span>
            <span className="month-subtitle">
              🔥 챌린지 성공 <span className="highlight-count">{targetId ? getSuccessDaysCount(targetId) : 0}일</span>
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
          {isAdmin ? '학생 캘린더 관리' : '마이 챌린지'}
        </button>
        <button 
          onClick={() => setActiveTab('all')} 
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
        >
          {isAdmin ? '우리 반 전체 현황' : '수다방 챌린지'}
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

          {isAdmin && (
            <div className="admin-select-wrapper">
              <select 
                className="admin-select"
                value={adminSelectedStudentId || ''} 
                onChange={(e) => setAdminSelectedStudentId(Number(e.target.value))}
              >
                <option value="" disabled>학생을 선택하세요</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {myCalendarView === 'month' ? (
            <>
              {!isAdmin && (
                <>
                  <p className="calendar-guide">오늘 칸을 눌러서 달성을 기록하세요.</p>
                  <div className="padlet-btn-wrapper">
                    <a href={PADLET_URL} target="_blank" rel="noopener noreferrer" className="padlet-link-btn">
                      📸 오늘의 챌린지하러 가기
                    </a>
                  </div>
                </>
              )}

              {targetId && (
                <div className="calendar-grid">
                  {Array.from({ length: getEmptyBlocksCount(currentYear, currentMonth) }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="empty-block" />
                  ))}
                  
                  {weekdays.map(d => {
                    const count = getSolvedCount(targetId, d);
                    const isDone = count >= 3;
                    const isToday = d === todayStr;
                    const dayNum = Number(d.split('-')[2]); 

                    return (
                      <div 
                        key={d} 
                        title={isToday ? "오늘 날짜 🎯" : d}
                        onClick={() => handleSquareClick(d, targetId)} 
                        className={`day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''} ${isAdmin ? 'admin-clickable' : ''}`}
                      >
                        {dayNum}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="yearly-view-container">
              {targetId && (
                <>
                  <div className="yearly-total-score">
                    ✨ {currentYear}년 누적 달성: <span className="highlight-count">{getSuccessDaysCountByYear(targetId, currentYear)}일</span>
                  </div>
                  <div className="yearly-grid">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                      const monthWeekdays = getWeekdaysOfMonth(currentYear, month);
                      const emptyCount = getEmptyBlocksCount(currentYear, month);
                      const monthSuccessCount = getSuccessDaysCountByMonth(targetId, currentYear, month);
                      
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
                              const count = getSolvedCount(targetId, d);
                              const isDone = count >= 3;
                              const isToday = d === todayStr;
                              const dayNum = Number(d.split('-')[2]); 

                              return (
                                <div 
                                  key={d} 
                                  title={d}
                                  onClick={() => handleSquareClick(d, targetId)}
                                  className={`small-day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''} ${isAdmin ? 'admin-clickable' : ''}`}
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
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'all' && (
        <div className="all-board-list">
          {[...students]
            .sort((a, b) => a.name.localeCompare(b.name, 'ko')) 
            .map(s => {
              const isMe = s.id === currentStudent?.id;
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
                          onClick={() => { if (isAdmin) handleSquareClick(d, s.id); }}
                          className={`small-day-block ${isDone ? 'done' : ''} ${isToday ? 'today' : ''} ${isAdmin ? 'admin-clickable' : ''}`}
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