import { getEligiblePositions } from "@/lib/stats";
import { getOOPRating } from "@/lib/depth-charts/oop-penalties";
import type { Player } from "@/lib/types";

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
  customPositions?: string[];
}

/**
 * Consolidated position + eligibility display.
 * Primary position is bolded; secondary positions shown in muted text with defense ratings.
 * OOP positions shown with dashed underline and penalty ratings.
 * Catchers show SB/CS rates instead of field ratings.
 */
export function PositionDisplay({ player, customPositions }: PositionDisplayProps) {
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
        {customPositions && customPositions.length > 0 && (
          <OOPPositionsList player={player as Player} customPositions={customPositions} />
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
      {customPositions && customPositions.length > 0 && (
        <OOPPositionsList player={player as Player} customPositions={customPositions} />
      )}
    </span>
  );
}

function OOPPositionsList({ player, customPositions }: { player: Player; customPositions: string[] }) {
  return (
    <>
      {customPositions.map((pos) => {
        const rating = getOOPRating(player, pos);
        const display = rating !== null ? `${pos}(${rating.toFixed(2)})` : pos;
        return (
          <span key={pos}>
            {", "}
            <span className="text-muted-foreground underline decoration-dashed decoration-muted-foreground/50 underline-offset-2">
              {display}
            </span>
          </span>
        );
      })}
    </>
  );
}
