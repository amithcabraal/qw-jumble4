import React, { useEffect, useState } from 'react';
import { Player } from '../types/game';
import { useGameStore } from '../store/gameStore';
import clsx from 'clsx';
import { Keyboard } from './Keyboard';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

// Map API status to our internal status
const STATUS_MAP: Record<string, string> = {
  'c': 'correct',
  'o': 'absent',
  'p': 'present',
  'r': 'absent',  // 'r' status should be treated as absent
  'correct': 'correct',
  'present': 'present',
  'absent': 'absent'
};

interface GameBoardProps {
  player: Player;
  isCurrentPlayer: boolean;
  showLetters?: boolean;
}

export function GameBoard({ player, isCurrentPlayer, showLetters = true }: GameBoardProps) {
  const [currentGuess, setCurrentGuess] = useState('');
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const { submitGuess, game } = useGameStore();

  // Initialize guesses and results with empty arrays if undefined
  const guesses = player?.guesses || [];
  const results = player?.results || [];

  console.log('[QuizWordz Debug] GameBoard State:', {
    isCurrentPlayer,
    guesses,
    results,
    currentGuess,
    gameStatus: game?.status
  });

  const handleKeyPress = async (key: string) => {
    if (!isCurrentPlayer || !game || game.status !== 'playing' || player.solved) return;

    console.log('[QuizWordz Debug] Key pressed:', {
      key,
      currentGuess,
      guessLength: currentGuess.length
    });

    if (key === 'Enter') {
      if (currentGuess.length !== WORD_LENGTH) {
        setShakingRow(guesses.length);
        setTimeout(() => setShakingRow(null), 500);
        return;
      }
      
      try {
        console.log('[QuizWordz Debug] Submitting guess:', currentGuess);
        await submitGuess(currentGuess);
        setRevealingRow(guesses.length);
        setTimeout(() => setRevealingRow(null), WORD_LENGTH * 100 + 600);
        setCurrentGuess('');
      } catch (error) {
        console.error('[QuizWordz Debug] Error submitting guess:', error);
      }
    } else if (key === 'Backspace') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (
      currentGuess.length < WORD_LENGTH && 
      /^[A-Za-z]$/.test(key) &&
      !player.solved
    ) {
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  };

  useEffect(() => {
    if (!isCurrentPlayer || !game || game.status !== 'playing') return;

    const handleKeyboardPress = (e: KeyboardEvent) => {
      handleKeyPress(e.key);
    };

    window.addEventListener('keydown', handleKeyboardPress);
    return () => window.removeEventListener('keydown', handleKeyboardPress);
  }, [currentGuess, game, isCurrentPlayer, player.solved, submitGuess]);

  // Calculate used letters for keyboard with priority
  const usedLetters = guesses.reduce((acc, guess, guessIndex) => {
    guess.split('').forEach((letter, letterIndex) => {
      const apiStatus = results[guessIndex]?.[letterIndex];
      const status = STATUS_MAP[apiStatus] || 'absent';
      
      console.log('[QuizWordz Debug] Letter status calculation:', {
        letter,
        apiStatus,
        mappedStatus: status,
        currentStatus: acc[letter],
        willUpdate: status === 'correct' || !acc[letter] || (status === 'present' && acc[letter] === 'absent')
      });
      
      // Priority: correct > present > absent
      if (status === 'correct' || !acc[letter]) {
        acc[letter] = status;
      } else if (!acc[letter] || (status === 'present' && acc[letter] === 'absent')) {
        acc[letter] = status;
      }
    });
    return acc;
  }, {} as Record<string, string>);

  console.log('[QuizWordz Debug] Used letters:', usedLetters);

  // Build the grid with current state
  const guessGrid = Array(MAX_ATTEMPTS).fill(null).map((_, rowIndex) => {
    const isCurrentRow = rowIndex === guesses.length;
    const guess = guesses[rowIndex] || '';
    const result = results[rowIndex] || Array(WORD_LENGTH).fill(null);
    
    console.log('[QuizWordz Debug] Building row:', {
      rowIndex,
      guess,
      result,
      isCurrentRow
    });
    
    return Array(WORD_LENGTH).fill(null).map((_, colIndex) => {
      const letter = isCurrentRow && isCurrentPlayer 
        ? currentGuess[colIndex] || ''
        : guess[colIndex] || '';
      
      const apiStatus = result[colIndex];
      const status = STATUS_MAP[apiStatus] || 'absent';
      const hasResult = apiStatus !== null && guess !== '';

      console.log('[QuizWordz Debug] Cell rendering:', {
        rowIndex,
        colIndex,
        letter,
        apiStatus,
        mappedStatus: status,
        hasResult
      });

      return {
        letter: showLetters ? letter : (letter ? '?' : ''),
        status,
        hasResult,
      };
    });
  });

  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <div className="grid grid-rows-6 gap-2 mb-4">
        {guessGrid.map((row, rowIndex) => (
          <div 
            key={rowIndex} 
            className={clsx(
              "grid grid-cols-5 gap-2",
              {
                'animate-shake': shakingRow === rowIndex
              }
            )}
          >
            {row.map((cell, colIndex) => {
              const isRevealing = revealingRow === rowIndex;
              const showAnimation = isCurrentPlayer || !isCurrentPlayer;
              
              const cellClasses = clsx(
                'w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold rounded',
                'transition-all duration-300',
                {
                  'animate-pop': cell.letter && !cell.hasResult && showAnimation,
                  'scale-110': !cell.hasResult && cell.letter,
                  'border-gray-300': !cell.hasResult && cell.letter,
                  'border-gray-200': !cell.hasResult && !cell.letter,
                  'animate-flip bg-green-500 text-white border-green-600': cell.hasResult && cell.status === 'correct',
                  'animate-flip bg-yellow-500 text-white border-yellow-600': cell.hasResult && cell.status === 'present',
                  'animate-flip bg-gray-500 text-white border-gray-600': cell.hasResult && cell.status === 'absent'
                }
              );

              console.log('[QuizWordz Debug] Cell classes:', {
                rowIndex,
                colIndex,
                letter: cell.letter,
                status: cell.status,
                hasResult: cell.hasResult,
                classes: cellClasses
              });

              return (
                <div
                  key={colIndex}
                  className={cellClasses}
                  style={{
                    animationDelay: isRevealing ? `${colIndex * 100}ms` : '0ms',
                    transitionDelay: isRevealing ? `${colIndex * 100}ms` : '0ms'
                  }}
                >
                  {cell.letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isCurrentPlayer && game?.status === 'playing' && !player.solved && (
        <>
          <div className="mt-4 text-center text-sm text-gray-600 mb-4">
            Type your guess and press Enter
          </div>
          <Keyboard 
            onKeyPress={handleKeyPress}
            usedLetters={usedLetters}
          />
        </>
      )}

      {player.solved && (
        <div className="mt-4 text-center text-lg font-semibold text-green-600 animate-bounce">
          Word solved! 🎉
        </div>
      )}

      {!isCurrentPlayer && game?.status === 'waiting' && (
        <div className="mt-4 text-center text-lg text-gray-600">
          Waiting for host to start the game...
        </div>
      )}
    </div>
  );
}