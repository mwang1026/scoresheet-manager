export function NewsFeed() {
  const dummyNews = [
    {
      headline: "Aaron Judge hits 2 home runs in victory over Red Sox",
      source: "ESPN",
      time: "2 hours ago",
    },
    {
      headline: "Shohei Ohtani expected to return from IL next week",
      source: "MLB.com",
      time: "4 hours ago",
    },
    {
      headline: "Fernando Tatis Jr. placed on 10-day IL with shoulder soreness",
      source: "The Athletic",
      time: "6 hours ago",
    },
  ];

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Recent News</h2>
      <div className="space-y-4">
        {dummyNews.map((item, index) => (
          <div key={index}>
            <div className="text-sm font-medium leading-snug">{item.headline}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {item.source} • {item.time}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground italic">
        Placeholder - news integration coming soon
      </p>
    </div>
  );
}
