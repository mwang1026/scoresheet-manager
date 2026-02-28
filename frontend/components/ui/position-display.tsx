import { getEligiblePositions } from "@/lib/stats";

interface PositionDisplayProps {
  player: {
    primary_position: string;
    eligible_1b: boolean | number | null;
    eligible_2b: boolean | number | null;
    eligible_3b: boolean | number | null;
    eligible_ss: boolean | number | null;
    eligible_of: boolean | number | null;
    osb_al: number | null;
    ocs_al: number | null;
  };
}

/**
 * Consolidated position + eligibility display.
 * Primary position is bolded; secondary positions shown in muted text with defense ratings.
 * Catchers show SB/CS rates instead of field ratings.
 */
export function PositionDisplay({ player }: PositionDisplayProps) {
  if (player.primary_position === "C") {
    const hasCatcherRates = player.osb_al !== null && player.ocs_al !== null;
    return (
      <span className="whitespace-nowrap">
        <span className="font-semibold">C</span>
        {hasCatcherRates && (
          <span className="text-muted-foreground">
            {" "}({player.osb_al!.toFixed(2)}-{player.ocs_al!.toFixed(2)})
          </span>
        )}
      </span>
    );
  }

  const positions = getEligiblePositions(player);

  return (
    <span className="whitespace-nowrap">
      {positions.map((pos, i) => {
        const isPrimary = i === 0;
        return (
          <span key={pos}>
            {i > 0 && ", "}
            {isPrimary ? (
              <span className="font-semibold">{pos}</span>
            ) : (
              <span className="text-muted-foreground">{pos}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
