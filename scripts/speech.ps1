param([string]$InputPath, [string]$OutputPath, [string]$Gender = 'female', [switch]$List)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en-*' })
  if ($List) { ConvertTo-Json -InputObject @($voices | ForEach-Object { [PSCustomObject]@{name=$_.VoiceInfo.Name; gender=$_.VoiceInfo.Gender.ToString()} }); exit }
  $selected = $voices | Where-Object { $_.VoiceInfo.Gender.ToString() -ieq $Gender } | Select-Object -First 1
  if (-not $selected) { throw "No installed English $Gender voice. Install a Windows voice or choose another voice." }
  $synth.SelectVoice($selected.VoiceInfo.Name)
  $voiceName = $selected.VoiceInfo.Name
  $synth.Dispose()
  Add-Type -ReferencedAssemblies ([System.Speech.Synthesis.SpeechSynthesizer].Assembly.Location) -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class TimedWord { public string text; public double start; }
public class LocalNarration {
  public static List<TimedWord> Generate(string text, string voice, string file) {
    var words = new List<TimedWord>();
    using (var speech = new SpeechSynthesizer()) {
      speech.SelectVoice(voice);
      speech.Rate = 0;
      speech.SpeakProgress += (sender, e) => {
        words.Add(new TimedWord { text = text.Substring(e.CharacterPosition, e.CharacterCount), start = e.AudioPosition.TotalSeconds });
      };
      speech.SetOutputToWaveFile(file, new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
      speech.Speak(text);
      speech.SetOutputToNull();
    }
    return words;
  }
}
'@
  $timings = [LocalNarration]::Generate([System.IO.File]::ReadAllText($InputPath), $voiceName, $OutputPath)
  $json = ConvertTo-Json -InputObject @($timings) -Depth 3
  [System.IO.File]::WriteAllText(($OutputPath + '.json'), $json)
  Write-Output $voiceName
} finally { $synth.Dispose() }
