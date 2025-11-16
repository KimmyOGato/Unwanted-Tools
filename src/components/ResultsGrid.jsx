import { useState } from 'react'
import ResultCard from './ResultCard'

export default function ResultsGrid({ items, selected, onSelect, locale }) {
  return (
    <div className="results-grid">
      {items.map((item, idx) => (
        <ResultCard
          key={`${item.timestamp}_${idx}`}
          item={item}
          isSelected={selected.has(idx)}
          onToggle={() => {
            const newSelected = new Set(selected)
            if (newSelected.has(idx)) {
              newSelected.delete(idx)
            } else {
              newSelected.add(idx)
            }
            onSelect(newSelected)
          }}
          locale={locale}
        />
      ))}
    </div>
  )
}