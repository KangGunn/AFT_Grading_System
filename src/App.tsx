import { useState } from 'react';
import AftGradeView from './components/AftGradeView';

export type DisplayMode = 'auto' | 'tv';

function App() {
  const [displayMode] = useState<DisplayMode>('auto');

  return (
    <div className="h-full w-full overflow-hidden bg-slate-900 text-slate-100">
      <AftGradeView 
        displayMode={displayMode} 
      />
    </div>
  );
}

export default App;
