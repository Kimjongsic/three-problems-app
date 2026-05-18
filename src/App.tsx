import { useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  useEffect(() => {
    const testConnection = async () => {
      // 'profiles' 대신 우리가 아까 만든 'challenge_logs' 테이블로 테스트합니다.
      const { data, error } = await supabase.from('challenge_logs').select('*').limit(1);
      
      if (error) {
        console.error('❌ Supabase 연결 에러:', error.message);
      } else {
        console.log('✅ Supabase 연결 성공! 데이터:', data);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Vite + Supabase 연결 테스트 화면</h1>
      <p>키보드에서 F12를 눌러 [콘솔(Console)] 창을 확인해보세요!</p>
    </div>
  );
}

export default App;