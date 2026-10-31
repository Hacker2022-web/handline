import { useState } from 'react';
import { Plus, MagnifyingGlass, PencilSimple, Trash, ArrowRight, Hand } from '@phosphor-icons/react';
import type { Gesture } from '../lib/types';
import { GestureIcon } from './GestureIcon';

export function Library({ gestures, onAdd, onEdit, onDelete, onToggle, onSay }: {
  gestures: Gesture[]; onAdd: () => void; onEdit: (g: Gesture) => void;
  onDelete: (g: Gesture) => void; onToggle: (g: Gesture) => void; onSay: (g: Gesture) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const matching = gestures.filter(g => (filter === 'all' || g.source === filter) && `${g.name} ${g.phrase}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="page-title"><div><span className="eyebrow">BUILT AROUND YOU</span><h1>Your gesture library</h1><p>A personal shortcut for the things you want to say.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={19} />Add a gesture</button></div>
    <div className="library-tools"><div className="filter-tabs" aria-label="Filter gestures">{[['all', 'All gestures'], ['preset', 'Presets'], ['custom', 'Your gestures']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="search-field"><MagnifyingGlass size={19} /><input aria-label="Search gestures" placeholder="Find a gesture or phrase" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <div className="library-grid">{matching.map(gesture => <article key={gesture.id} className={`gesture-card ${gesture.enabled ? '' : 'gesture-disabled'}`}>
      <div className="gesture-card-top"><span className="gesture-icon"><GestureIcon gesture={gesture} size={34} /></span><span className="tag">{gesture.source === 'preset' ? 'PRESET' : `${gesture.samples.length} EXAMPLES`}</span><label className="toggle"><input type="checkbox" role="switch" aria-label={`Enable ${gesture.name}`} checked={gesture.enabled} onChange={() => onToggle(gesture)} /><span /></label></div>
      <h2>{gesture.name}</h2><p className="gesture-phrase">“{gesture.phrase}”</p>
      <div className="gesture-card-footer"><button className="text-button" onClick={() => onSay(gesture)} disabled={!gesture.enabled}>Say this<ArrowRight size={16} /></button><div className="flex gap-1"><button className="icon-button" aria-label={`Edit ${gesture.name}`} onClick={() => onEdit(gesture)}><PencilSimple size={19} /></button>{gesture.source === 'custom' && <button className="icon-button" aria-label={`Delete ${gesture.name}`} onClick={() => onDelete(gesture)}><Trash size={19} /></button>}</div></div>
    </article>)}
      {filter !== 'preset' && !query && <button className="add-gesture-card" onClick={onAdd}><span><Plus size={27} /></span><strong>Make it your own</strong><p>One familiar gesture.<br />The words that matter to you.</p><span className="text-button">Teach a new gesture<ArrowRight size={16} /></span></button>}
    </div>
    {!matching.length && <div className="empty-state"><Hand size={40} weight="thin" /><h2>{query ? 'No matching gestures' : 'Your vocabulary starts here'}</h2><p>{query ? 'Try another gesture name or phrase.' : 'Add a gesture and record eight examples to teach your personal pose.'}</p>{!query && <button className="button button-primary" onClick={onAdd}><Plus size={18} />Add your first gesture</button>}</div>}
    <div className="footnote-box"><Hand size={21} /><p>These are personal mappings. Preset meanings are starting points, and every phrase is yours to edit. Handline does not translate sign language.</p></div>
  </>;
}
