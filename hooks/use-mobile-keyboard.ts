// hooks/use-mobile-keyboard.ts
"use client";

import { useEffect, useState } from 'react';

export function useMobileKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastHeight = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = lastHeight - currentHeight;
      
      // Keyboard is likely open if viewport shrinks by more than 100px
      if (heightDiff > 100) {
        setIsKeyboardOpen(true);
        setKeyboardHeight(heightDiff);
        document.body.classList.add('keyboard-open');
      } else if (Math.abs(heightDiff) < 50 && isKeyboardOpen) {
        // Keyboard closed
        setIsKeyboardOpen(false);
        setKeyboardHeight(0);
        document.body.classList.remove('keyboard-open');
      }
      
      lastHeight = currentHeight;
    };

    // Visual Viewport API (better for mobile)
    if ('visualViewport' in window) {
      const viewport = window.visualViewport;
      
      const handleViewportChange = () => {
        const hasKeyboard = window.innerHeight - (viewport?.height || 0) > 100;
        setIsKeyboardOpen(hasKeyboard);
        setKeyboardHeight(hasKeyboard ? window.innerHeight - (viewport?.height || 0) : 0);
        
        if (hasKeyboard) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      };

      viewport?.addEventListener('resize', handleViewportChange);
      viewport?.addEventListener('scroll', handleViewportChange);
      
      return () => {
        viewport?.removeEventListener('resize', handleViewportChange);
        viewport?.removeEventListener('scroll', handleViewportChange);
      };
    } else {
      // Fallback for browsers without Visual Viewport API
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isKeyboardOpen]);

  return { isKeyboardOpen, keyboardHeight };
}

// Usage in your chat component:
/*
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard';

function ChatPage() {
  const { isKeyboardOpen, keyboardHeight } = useMobileKeyboard();
  
  return (
    <div style={{ 
      paddingBottom: isKeyboardOpen ? `${keyboardHeight}px` : '0' 
    }}>
      // Your chat UI
    </div>
  );
}
*/