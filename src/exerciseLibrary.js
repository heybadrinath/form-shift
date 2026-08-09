const asset = (name) => `/assets/exercises/${name}.webp`;

export const exerciseGuides = {
  "incline-pushup": {
    label: "Incline push-up",
    variants: [
      {
        id: "bench",
        label: "Bench",
        equipment: "Stable flat bench",
        image: asset("incline-pushup-bench"),
        steps: [
          "Set the bench high enough to keep every repetition clean.",
          "Brace from head to heel and bring the chest between the hands.",
          "Press the bench away without letting the hips sag.",
        ],
        avoid: "Do not use a bench that slides or test floor push-ups when form is already failing.",
      },
    ],
  },
  "chest-press": {
    label: "Chest press",
    variants: [
      {
        id: "machine",
        label: "Machine",
        equipment: "Confirmed: incline chest-press machine",
        image: asset("incline-chest-press-machine"),
        steps: [
          "Adjust the seat from the machine placard so the handles begin around upper-to-mid chest.",
          "Keep your back and shoulder blades supported while you press smoothly.",
          "Stop short of a painful depth and return without letting the stack slam.",
        ],
        avoid: "If shoulder-joint pain returns after one lighter, shorter-range attempt, stop this movement.",
      },
      {
        id: "dumbbells",
        label: "Dumbbells",
        equipment: "Confirmed: adjustable bench + dumbbells",
        image: asset("incline-dumbbell-chest-press"),
        steps: [
          "Use a low incline and begin with the dumbbells close to the chest.",
          "Keep wrists stacked and elbows roughly 30–45° from the torso.",
          "Press up and slightly inward, then lower only through a pain-free range.",
        ],
        avoid: "Do not force the dumbbells deep below the chest or shrug toward the ears.",
      },
    ],
  },
  "lat-pulldown": {
    label: "Lat pulldown",
    variants: [
      {
        id: "machine",
        label: "Pulldown",
        equipment: "Confirmed: lat-pulldown station",
        image: asset("lat-pulldown-machine"),
        steps: [
          "Lock the thighs under the pad and use a comfortable overhand or neutral grip.",
          "Pull the elbows toward the ribs with only a small torso lean.",
          "Return slowly until the shoulders feel comfortably long.",
        ],
        avoid: "Never pull behind the neck or turn the repetition into a body swing.",
      },
    ],
  },
  row: {
    label: "Row",
    variants: [
      {
        id: "machine",
        label: "Machine",
        equipment: "Confirmed: seated-row machine",
        image: asset("seated-row-machine"),
        steps: [
          "Set the chest pad so you can reach the handles without rounding forward.",
          "Lead with the elbows and pull toward the lower ribs.",
          "Pause without shrugging, then return under control.",
        ],
        avoid: "Reduce the load if you must jerk or lean backward to finish.",
      },
      {
        id: "dumbbell",
        label: "Dumbbell",
        equipment: "Confirmed: bench + dumbbell",
        image: asset("one-arm-dumbbell-row"),
        steps: [
          "Support one hand and knee on the bench with a long, neutral spine.",
          "Pull the dumbbell toward the hip while the torso stays square.",
          "Lower until the shoulder is comfortably long without twisting.",
        ],
        avoid: "Do not rotate the chest open or yank the weight from the floor.",
      },
    ],
  },
  "lateral-raise": {
    label: "Lateral raise",
    variants: [
      {
        id: "dumbbells",
        label: "Dumbbells",
        equipment: "Confirmed: light dumbbells",
        image: asset("dumbbell-lateral-raise"),
        steps: [
          "Stand tall with very light dumbbells and soft elbows.",
          "Lift slightly forward of your sides until around shoulder height.",
          "Lower slowly while keeping the neck relaxed.",
        ],
        avoid: "Do not shrug, swing, or chase a heavy weight.",
      },
      {
        id: "cable",
        label: "Cable",
        equipment: "Confirmed: adjustable cable station",
        image: asset("cable-lateral-raise"),
        steps: [
          "Set the pulley low and stand side-on with the cable crossing in front.",
          "Keep the torso still and lift the arm slightly forward of the body.",
          "Stop near shoulder height and return with control.",
        ],
        avoid: "Stop immediately for sharp or deep shoulder-joint pain.",
      },
    ],
  },
  triceps: {
    label: "Triceps",
    variants: [
      {
        id: "cable",
        label: "Cable",
        equipment: "Confirmed: cable station + rope",
        image: asset("rope-triceps-pressdown"),
        steps: [
          "Set the pulley high and pin the elbows close to the ribs.",
          "Move only the forearms as you press the rope down.",
          "Return slowly without letting the elbows drift forward.",
        ],
        avoid: "Do not lean your body weight onto the rope.",
      },
      {
        id: "dumbbell",
        label: "Dumbbell",
        equipment: "Confirmed: light dumbbell + bench",
        image: asset("dumbbell-triceps-kickback"),
        steps: [
          "Support one hand on the bench and keep the working upper arm beside the torso.",
          "Straighten the elbow until the arm is long without moving the shoulder.",
          "Return slowly and keep the weight light.",
        ],
        avoid: "Do not swing the upper arm or force a shoulder position that hurts.",
      },
    ],
  },
  curl: {
    label: "Curl",
    variants: [
      {
        id: "dumbbells",
        label: "Dumbbells",
        equipment: "Confirmed: dumbbells",
        image: asset("dumbbell-hammer-curl"),
        steps: [
          "Stand tall with palms facing each other and elbows beside the ribs.",
          "Curl without moving the upper arms or leaning backward.",
          "Lower for longer than you lift.",
        ],
        avoid: "Choose a lighter pair if the torso swings.",
      },
      {
        id: "cable",
        label: "Cable",
        equipment: "Confirmed: adjustable cable station",
        image: asset("cable-biceps-curl"),
        steps: [
          "Set the pulley low and stand far enough back to keep tension.",
          "Keep the elbows quiet while curling the handle toward the shoulders.",
          "Return until the arms are long without letting the stack crash.",
        ],
        avoid: "Do not turn the curl into a hip or back movement.",
      },
    ],
  },
  cardio: {
    label: "Pain-free cardio",
    variants: [
      {
        id: "treadmill",
        label: "Treadmill",
        equipment: "Confirmed: treadmill",
        image: asset("treadmill-walk"),
        steps: [
          "Begin slowly and build to a pace where full sentences remain possible.",
          "Look ahead, stay near the middle of the belt and let the arms swing.",
          "Reduce speed until you can walk without holding the rails.",
        ],
        avoid: "Do not run while shin pain occurs during or after walking.",
      },
    ],
  },
  "leg-press": {
    label: "Leg press",
    variants: [
      {
        id: "machine",
        label: "Machine",
        equipment: "Confirmed: leg-press machine",
        image: asset("leg-press-machine"),
        steps: [
          "Place the feet around shoulder width near the middle of the platform.",
          "Keep the hips and lower back supported while lowering under control.",
          "Press through the whole foot and keep knees tracking with toes.",
        ],
        avoid: "Do not slam or aggressively lock the knees.",
      },
    ],
  },
  "leg-curl": {
    label: "Leg curl",
    variants: [
      {
        id: "seated",
        label: "Seated",
        equipment: "Confirmed: leg-curl machine; choose this if it matches yours",
        image: asset("seated-leg-curl-machine"),
        steps: [
          "Align the knees with the machine pivot and secure the thigh pad.",
          "Place the roller just above the heels and curl down smoothly.",
          "Return without lifting the hips or letting the stack slam.",
        ],
        avoid: "Do not use a seat setting that pulls the knee away from the pivot.",
      },
      {
        id: "lying",
        label: "Lying",
        equipment: "Confirmed: leg-curl machine; choose this if it matches yours",
        image: asset("lying-leg-curl-machine"),
        steps: [
          "Align the knees just beyond the bench hinge and place the roller above the heels.",
          "Keep the hips heavy on the pad while curling toward the glutes.",
          "Lower smoothly until the knees are almost straight.",
        ],
        avoid: "Do not arch the lower back or bounce the roller.",
      },
    ],
  },
  bridge: {
    label: "Glute bridge",
    variants: [
      {
        id: "bodyweight",
        label: "Bodyweight",
        equipment: "Floor mat",
        image: asset("bodyweight-glute-bridge"),
        steps: [
          "Plant the feet so the shins are close to vertical at the top.",
          "Keep ribs down and squeeze the glutes to lift the hips.",
          "Pause briefly, then lower without losing trunk position.",
        ],
        avoid: "Stop before the movement turns into a lower-back arch.",
      },
      {
        id: "dumbbell",
        label: "Dumbbell",
        equipment: "Dumbbell + folded towel or pad",
        image: asset("dumbbell-glute-bridge"),
        steps: [
          "Place a light dumbbell securely across the hip crease over padding.",
          "Hold it with both hands while driving the hips up with the glutes.",
          "Keep ribs down and lower slowly.",
        ],
        avoid: "Do not load this version until the bodyweight bridge is controlled.",
      },
    ],
  },
  calf: {
    label: "Calf raise",
    variants: [
      {
        id: "bodyweight",
        label: "Bodyweight",
        equipment: "Wall or stable support",
        image: asset("bodyweight-calf-raise"),
        steps: [
          "Use light fingertip support and keep the ankles pointing forward.",
          "Rise through the balls of the feet without rolling outward.",
          "Pause at the top and lower slowly.",
        ],
        avoid: "Do not bounce through a painful range.",
      },
      {
        id: "dumbbell",
        label: "Dumbbell",
        equipment: "One dumbbell + stable support",
        image: asset("dumbbell-calf-raise"),
        steps: [
          "Hold one light dumbbell while the free hand touches a stable support.",
          "Rise evenly through the forefoot and pause at the top.",
          "Lower under control before the next repetition.",
        ],
        avoid: "Use bodyweight if the load changes balance or ankle position.",
      },
    ],
  },
  tibialis: {
    label: "Tibialis raise",
    variants: [
      {
        id: "wall",
        label: "Wall",
        equipment: "Wall",
        image: asset("wall-tibialis-raise"),
        steps: [
          "Lean the upper back against a wall with the feet slightly forward.",
          "Keep heels planted while lifting both forefeet toward the shins.",
          "Lower slowly and keep the range comfortable.",
        ],
        avoid: "Omit it if focal shin-bone pain appears now or the next morning.",
      },
    ],
  },
  "front-plank": {
    label: "Front plank",
    variants: [
      {
        id: "forearms",
        label: "Forearms",
        equipment: "Floor mat",
        image: asset("forearm-front-plank"),
        steps: [
          "Place elbows under shoulders and gently push the floor away.",
          "Stack ribs over pelvis and squeeze the glutes lightly.",
          "Breathe normally until just before the position changes.",
        ],
        avoid: "End the set before the hips sag or the lower back takes over.",
      },
    ],
  },
  "dead-bug": {
    label: "Dead bug",
    variants: [
      {
        id: "floor",
        label: "Floor",
        equipment: "Floor mat",
        image: asset("dead-bug"),
        steps: [
          "Start with hips and knees bent and arms pointing upward.",
          "Extend opposite arm and leg only as far as the lower back stays still.",
          "Return slowly and alternate sides.",
        ],
        avoid: "Shorten the reach when the ribs flare or lower back lifts.",
      },
    ],
  },
  compression: {
    label: "Seated compression",
    variants: [
      {
        id: "bench",
        label: "Bench",
        equipment: "Stable bench",
        image: asset("seated-single-leg-compression"),
        steps: [
          "Sit near the bench edge with one leg straight and hands beside the thigh.",
          "Stay tall while lifting the straight heel a few centimetres.",
          "Lower with control and alternate sides.",
        ],
        avoid: "Do not lean backward to manufacture extra height.",
      },
    ],
  },
  "assisted-pullup": {
    label: "Assisted pull-up",
    variants: [
      {
        id: "machine",
        label: "Machine",
        equipment: "Confirmed: assisted pull-up machine",
        image: asset("assisted-pullup-machine"),
        steps: [
          "Select enough assistance to move without kicking; more stack weight usually means more help.",
          "Begin long through the arms, then pull elbows toward the ribs.",
          "Lower slowly until the shoulders are comfortably extended.",
        ],
        avoid: "Do not drop onto or jump off the assistance pad.",
      },
    ],
  },
  "rear-delt": {
    label: "Rear-delt fly",
    variants: [
      {
        id: "cable",
        label: "Cable",
        equipment: "Confirmed: adjustable cable station",
        image: asset("cable-rear-delt-fly"),
        steps: [
          "Set two light cables around shoulder height and stand with arms crossed in front.",
          "Open the arms outward with soft elbows and a quiet torso.",
          "Stop before shrugging, then return slowly.",
        ],
        avoid: "Keep this very light; skip it for shoulder-joint pain.",
      },
      {
        id: "dumbbells",
        label: "Dumbbells",
        equipment: "Confirmed: bench + light dumbbells",
        image: asset("dumbbell-reverse-fly"),
        steps: [
          "Support the chest on a low-incline bench with very light dumbbells.",
          "Open the arms with soft elbows while the chest stays on the pad.",
          "Pause before the shoulders shrug, then lower slowly.",
        ],
        avoid: "Do not turn this into a heavy row.",
      },
    ],
  },
  crunch: {
    label: "Abdominal curl",
    variants: [
      {
        id: "machine",
        label: "Machine",
        equipment: "Confirmed: seated crunch machine",
        image: asset("seated-crunch-machine"),
        steps: [
          "Adjust the seat and pad from the placard so the machine rotates comfortably with your trunk.",
          "Curl the ribs toward the pelvis without pulling with the arms.",
          "Return slowly while keeping the weight stack controlled.",
        ],
        avoid: "Do not chase a heavy stack or jerk through the hips.",
      },
      {
        id: "reverse",
        label: "Floor",
        equipment: "Floor mat",
        image: asset("reverse-crunch"),
        steps: [
          "Lie down with hips and knees bent and arms planted beside the body.",
          "Curl the pelvis gently so the tailbone leaves the floor.",
          "Lower one vertebra at a time without swinging the legs.",
        ],
        avoid: "This trains the abs; it does not selectively burn belly fat.",
      },
    ],
  },
  "side-plank": {
    label: "Side plank",
    variants: [
      {
        id: "forearm",
        label: "Forearm",
        equipment: "Floor mat",
        image: asset("forearm-side-plank"),
        steps: [
          "Stack the elbow under the shoulder with knees bent or legs straight.",
          "Lift the hips until the head, ribs and pelvis form one line.",
          "Breathe and stop before rotating or sagging.",
        ],
        avoid: "Use the bent-knee version if the shoulder cannot stay stable.",
      },
    ],
  },
};

export function guideKeyForExercise(exercise) {
  const id = exercise.id;
  if (id.includes("side-plank")) return "side-plank";
  if (id.includes("plank")) return "front-plank";
  if (id.includes("incline-pushup") || id === "d-pushup") return "incline-pushup";
  if (id.includes("chest-press")) return "chest-press";
  if (id.includes("pulldown")) return "lat-pulldown";
  if (id.includes("assisted-pullup") || id === "d-pullup") return "assisted-pullup";
  if (id.includes("reverse-pec")) return "rear-delt";
  if (id.includes("row")) return "row";
  if (id.includes("lateral-raise") || id === "d-raise") return "lateral-raise";
  if (id.includes("triceps")) return "triceps";
  if (id.includes("leg-curl")) return "leg-curl";
  if (id.includes("curl")) return "curl";
  if (id.includes("leg-press")) return "leg-press";
  if (id.includes("bridge")) return "bridge";
  if (id.includes("tibialis")) return "tibialis";
  if (id.includes("calf")) return "calf";
  if (id.includes("dead-bug")) return "dead-bug";
  if (id.includes("compression")) return "compression";
  if (id.includes("crunch")) return "crunch";
  if (id.includes("cardio")) return "cardio";
  return "cardio";
}

export function guideForExercise(exercise) {
  return exerciseGuides[guideKeyForExercise(exercise)];
}
