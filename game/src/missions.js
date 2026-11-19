// The eight-job story plan. Each stage is a small, testable objective with its own line of
// dialogue; the simulation reads this table and never invents mission rules of its own.

import { MISSIONS } from './config.js';

const STAGES = [
  [
    { kind: 'goto', spot: 'pickup', label: 'Collect Nia’s packet', dialogue: { speaker: 'Nia Vale', text: 'Sun’s barely up and the packet is already late. Grab it from Marisol Rows, then bring it to me at the plaza.' } },
    { kind: 'goto', spot: 'deliver', label: 'Deliver to Solano Plaza', dialogue: { speaker: 'Nia Vale', text: 'Over here. Nobody asks what is in the envelope, and nobody gets hurt.' } },
  ],
  [
    { kind: 'goto', spot: 'van', label: 'Reach the harbor van', dialogue: { speaker: 'Rafa Solis', text: 'The van is down by the pier. Two of Ines’s crew are watching it, so do not be gentle.' } },
    { kind: 'fight', spot: 'van', enemies: 2, label: 'Clear the van crew', dialogue: { speaker: 'Ines Marlow', text: 'You are in my harbor now. Leave the van and I might let you walk away.' } },
    { kind: 'goto', spot: 'garage', label: 'Park the van at the garage', dialogue: { speaker: 'Rafa Solis', text: 'Park it behind the garage on Palma Vista. Keys stay with you.' } },
  ],
  [
    { kind: 'chase', spot: 'runner', label: 'Catch the causeway runner', dialogue: { speaker: 'Ines Marlow', text: 'That is him, running for the seawall. Catch him before he hits the water.' } },
    { kind: 'goto', spot: 'plaza', label: 'Report to Solano Plaza', dialogue: { speaker: 'Ines Marlow', text: 'Good. We will talk where there are witnesses.' } },
  ],
  [
    { kind: 'goto', spot: 'garage', label: 'Pick up the garage keys', dialogue: { speaker: 'Ada Cruz', text: 'The garage has a car with your name on it. Take it for a spin and come see me.' } },
    { kind: 'goto', spot: 'deliver', label: 'Bring the car to the plaza', dialogue: { speaker: 'Ada Cruz', text: 'Slowly. I want to see who follows you.' } },
  ],
  [
    { kind: 'goto', spot: 'customs', label: 'Search the old customs dock', dialogue: { speaker: 'Marisol Reyes', text: 'The ledger is under the third crate by the old customs dock. Rafa lied about the tide.' } },
    { kind: 'goto', spot: 'ledger', label: 'Take the tide ledger', dialogue: { speaker: 'Marisol Reyes', text: 'That is the one. Keep it until I ask for it.' } },
  ],
  [
    { kind: 'goto', spot: 'tower', label: 'Sprint to the Glass Mile mark', dialogue: { speaker: 'Dante Ibarra', text: 'One minute, one tower, no excuses. The city is watching.' } },
    { kind: 'goto', spot: 'finale', label: 'Meet Dante at Solano', dialogue: { speaker: 'Dante Ibarra', text: 'You made it. Almost makes me believe in luck.' } },
  ],
  [
    { kind: 'goto', spot: 'customs', label: 'Enter the Customs House', dialogue: { speaker: 'Ada Cruz', text: 'Warrant is signed. Three crew inside; bring the office back to us.' } },
    { kind: 'fight', spot: 'customs', enemies: 3, label: 'Clear the Customs House', dialogue: { speaker: 'Ada Cruz', text: 'They have a ledger and a gun. Yours is bigger.' } },
    { kind: 'goto', spot: 'finale', label: 'Secure the office', dialogue: { speaker: 'Ada Cruz', text: 'Sealed. One job left, then this city can breathe.' } },
  ],
  [
    { kind: 'goto', spot: 'plaza', label: 'Reach Solano Plaza', dialogue: { speaker: 'Ada Cruz', text: 'They are waiting in the plaza. Four of them, and nowhere left to run.' } },
    { kind: 'fight', spot: 'plaza', enemies: 4, label: 'End the standoff', dialogue: { speaker: 'Dante Ibarra', text: 'No more messages. Finish it in the last of the sun.' } },
    { kind: 'goto', spot: 'finale', label: 'Take the final mark', dialogue: { speaker: 'Ada Cruz', text: 'It is done. Cielo Bay owes you one.' } },
  ],
];

/** Return an independent copy of the story plan for a fresh world. */
export function createMissionPlan() {
  return MISSIONS.map((mission, index) => ({
    ...mission,
    index,
    stages: STAGES[index].map((stage) => ({ ...stage })),
  }));
}
