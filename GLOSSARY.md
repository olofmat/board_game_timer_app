# Board Game Timer

Times a board game on a single phone so the group can see who plays slowly and which shared activities eat up the evening.

## Setup

**Game**:
One play-through, from Start to End game, with a fixed set of Players and Shared timers that can be adjusted mid-way.
_Avoid_: Session, match, round

**Player**:
A person taking turns in a Game. Each Player has a name and a Color, both unique within the Game (names ignoring case). A Player removed mid-Game keeps their recorded time and Turns.
_Avoid_: User, participant

**Shared timer**:
A clock for common time that belongs to no Player, such as "fight" or "buying". A Game has 0–4 of them, with names unique within the Game (ignoring case). While one runs, the Current player is the interrupted Player that play returns to.
_Avoid_: Activity, segment, user

**Saved name**:
A Player name or Shared timer name kept on the phone so it can be picked for future Games. Colors are never saved.
_Avoid_: Roster entry, profile, account

**Guest**:
A Player whose name is used for one Game only and not kept as a Saved name.

**Color**:
The piece color a Player picks per Game, used to fill the Player area while they are current.

**Turn order**:
The cyclic sequence of Players (A → B → C → A …) that swipes move through. Can be changed mid-Game; afterwards the first Player in the new order is the Current player.
_Avoid_: Seating, rotation

## Playing

**Current player**:
The Player shown in the Player area; swipes move relative to them. Being current does not mean their clock is running.

**Player area**:
The bottom three quarters of the game screen, showing the Current player. Swiping and tapping happen here.

**Activation delay**:
The 0.3 seconds after a swipe during which the new Current player is shown dimmed and gains no time. Swiping again within it skips that Player entirely. Tapping within it pauses on the new Current player before the Handover (the delay so far is Swiping time); the next tap resumes them at once and counts as the Handover.

**Handover**:
The moment the Activation delay ends and the new Current player's clock starts.

**Turn**:
A stretch of a Player's clock running, starting at a Handover to a different Player, when play returns to them from a Shared timer, or when play resumes after the Turn order is changed. Pausing does not split a Turn, and swiping back to the same Player before the Handover continues it.

**Swiping time**:
Time spent inside Activation delays, including ones started while paused. Belongs to no Player or Shared timer but is part of Game time.

**Paused time**:
Time while the Game is paused. Shown in the Summary but not part of Game time.

**Game time**:
The sum of all Players' time, all Shared timers' time, and Swiping time.
_Avoid_: Total time (ambiguous with a Player's total)

**Summary**:
The screen after End game listing each Player's total time, Turns and average Turn length, slowest first, followed by Shared timers, Swiping time, Paused time and Game time.
