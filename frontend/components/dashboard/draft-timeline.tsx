export function DraftTimeline() {
  const dummyEntries = [
    { round: 1, pick: 3, time: "2:15 PM", event: "Your pick upcoming" },
    { round: 1, pick: 7, time: "2:35 PM", event: "Power Hitters pick" },
    { round: 2, pick: 4, time: "3:10 PM", event: "Your pick upcoming" },
  ];

  return (
    <div className="border rounded-lg">
      <div className="p-4 bg-brand text-white rounded-t-lg">
        <h2 className="text-lg font-semibold">Draft Timeline</h2>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {dummyEntries.map((entry, index) => (
            <div key={index} className="border-l-2 border-muted pl-3">
              <div className="text-sm font-medium">
                Round {entry.round}, Pick {entry.pick}
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.time} • {entry.event}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground italic">
          Placeholder - connect draft schedule in Settings
        </p>
      </div>
    </div>
  );
}
