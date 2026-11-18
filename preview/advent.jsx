import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClubSelect, PremiumBackground } from '../main.jsx'
import wreath from './adventskranz.png'
import './advent.css'

// Fade the glow between the last lit candle and the next unlit candle.
const flameMasks = [
  'linear-gradient(to right, #000 23%, transparent 33%)',
  'linear-gradient(to right, #000 44%, transparent 55%)',
  'linear-gradient(to right, #000 66%, transparent 77%)',
  'linear-gradient(#000, #000)',
]

function AdventWreath() {
  const [advent, setAdvent] = useState(1)

  return (
    <figure className="advent-wreath">
      <img
        src={wreath}
        width="1536"
        height="1024"
        alt={advent === 1 ? 'Adventskranz mit einer brennenden Kerze' : `Adventskranz mit ${advent} brennenden Kerzen`}
        style={{ '--advent-flame-mask': flameMasks[advent - 1] }}
      />
      <figcaption>
        <fieldset>
          <legend>Adventsvorschau</legend>
          <div className="advent-choices">
            {flameMasks.map((_, index) => (
              <label key={index}>
                <input
                  type="radio"
                  name="advent"
                  checked={advent === index + 1}
                  onChange={() => setAdvent(index + 1)}
                />
                <span>{index + 1}. Advent</span>
              </label>
            ))}
          </div>
        </fieldset>
      </figcaption>
    </figure>
  )
}

createRoot(document.getElementById('root')).render(
  <><PremiumBackground /><ClubSelect preview heroVisual={<AdventWreath />} /></>,
)
