import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';

export function ActiveUsers() {
  const [activeCount, setActiveCount] = useState<number>(1);

  useEffect(() => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    // Try to safely store under 'data' which seems to be open.
    const sessionRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'active_sessions', sessionId);

    let isSubscribed = true;

    const ping = () => {
      setDoc(sessionRef, { lastActive: serverTimestamp() }, { merge: true }).catch(err => {
        console.log("Ping failed (could be rules):", err);
      });
    };
    
    // Initial ping
    ping();
    const intervalId = setInterval(ping, 60000);

    const handleUnload = () => {
      deleteDoc(sessionRef).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    // Watch active sessions
    const q = query(
      collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'active_sessions'),
      orderBy('lastActive', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isSubscribed) return;
      const now = Date.now();
      const activeWindow = 3 * 60 * 1000; // 3 minutes
      let count = 0;
      
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.lastActive) {
          const lastActiveTime = (data.lastActive as Timestamp).toMillis();
          if (now - lastActiveTime < activeWindow) {
            count++;
          }
        } else {
          // Local optimistic update
          count++;
        }
      });
      
      setActiveCount(Math.max(1, count));
    }, (error) => {
       console.log("ActiveUsers snapshot error:", error);
    });

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      unsubscribe();
      handleUnload();
    };
  }, []);

  return (
    <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 tracking-widest uppercase">
      <div className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
      </div>
      <span>{activeCount} Online</span>
    </div>
  );
}
