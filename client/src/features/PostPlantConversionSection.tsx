import { InfoLabel, Section, WinRateBar } from "../components/common";

const ALL = "all";

type PostPlantSiteStats = {
  plants: number;
  win_rate: number;
};

type PostPlantBySite = Record<string, PostPlantSiteStats> | undefined;

interface PostPlantConversionSectionProps {
  selectedMap: string;
  postPlantBySite?: PostPlantBySite;
}

export default function PostPlantConversionSection({
  selectedMap,
  postPlantBySite,
}: PostPlantConversionSectionProps) {
  if (!postPlantBySite || Object.keys(postPlantBySite).length === 0) {
    return null;
  }

  return (
    <Section title={selectedMap === ALL ? "Post-plant Conversions" : `Post-plant Conversions — ${selectedMap}`}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>
              <InfoLabel k="games">Plants</InfoLabel>
            </th>
            <th className="wr-col">
              <InfoLabel k="post_plant_conversion_by_site">Win rate</InfoLabel>
            </th>
          </tr>
        </thead>

        <tbody>
          {Object.entries(postPlantBySite).map(([site, stats]) => (
            <tr key={site}>
              <td className="name-cell">{site}</td>
              <td>{stats.plants}</td>
              <td className="wr-col">
                <WinRateBar pct={stats.win_rate} good={61} bad={49} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
