# Custom Alarm Ringtones

You can place your custom audio files (`.mp3`, `.ogg`, or `.wav`) in this directory (`assets/sounds/`).

### Step-by-Step Guide:

#### Step 1: Copy your audio file into this directory
Place your sound file here, for example:
`assets/sounds/my_tone.mp3`

#### Step 2: Register it in `src/constants/ringtones.js`
Open [`src/constants/ringtones.js`](../../src/constants/ringtones.js) and add your entry to the `ALARM_RINGTONES` array:

```javascript
{
  id: 'my_tone',
  name: 'My Custom Chime',
  description: 'Custom local MP3 transit alert',
  icon: '🎶',
  source: require('../../assets/sounds/my_tone.mp3'),
},
```

#### Step 3: Test and Select in App
Open the **Profile & Settings** tab in the app:
1. Tap **▶ Play** to preview the sound.
2. Tap the item to select it as your arrival alarm.
3. The selected ringtone is automatically saved and will ring loudly when approaching your destination.
