'use client';
import {useCallback, useEffect, useState, type SetStateAction} from 'react';
import {decodeNotebook, emptyNotebook, NOTEBOOK_KEY, type Notebook} from './notebook';

export function useNotebook() {
  const [book, setBook] = useState<Notebook>(emptyNotebook);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(true);
  const [notice, setNotice] = useState('训练记录只保存在当前浏览器。');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTEBOOK_KEY);
      if (raw) {
        const saved = decodeNotebook(raw);
        if (saved) {setBook(saved); setNotice('已恢复此浏览器的训练与错题记录。');}
        else {setSaving(false); setNotice('旧记录无法读取，暂未覆盖。当前可临时练习，也可导出后启用新记录保存。');}
      }
    } catch {setSaving(false); setNotice('浏览器暂不允许保存，当前可练习；离开前请导出记录。');}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !saving) return;
    try {localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(book));}
    catch {setSaving(false); setNotice('本地保存失败，当前记录仍在。请先导出备份；刷新可能丢失本次作答。');}
  }, [book, ready, saving]);
  const update = useCallback((value: SetStateAction<Notebook>) => setBook(value), []);
  const enableSaving = useCallback(() => {setSaving(true); setNotice('已启用新记录保存；当前训练与错题将写入此浏览器。');}, []);
  return {book, update, ready, notice, saving, enableSaving};
}
