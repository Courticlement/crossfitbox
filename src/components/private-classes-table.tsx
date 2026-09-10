import { DeleteClassButton } from "@/components/delete-class-button";

export type PrivateClassRow = {
  id: string;
  coachName: string;
  athleteName: string;
  athleteIsMember: boolean | null;
  dateLabel: string;
  time: string;
};

export function PrivateClassesTable({ rows }: { rows: PrivateClassRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900 text-left text-neutral-400">
          <tr>
            <th className="px-4 py-2 font-medium">Coach</th>
            <th className="px-4 py-2 font-medium">Athlète</th>
            <th className="px-4 py-2 font-medium">Abonnement</th>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Heure</th>
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group border-t border-neutral-800">
              <td className="px-4 py-2 text-white">{row.coachName}</td>
              <td className="px-4 py-2">{row.athleteName}</td>
              <td className="px-4 py-2">
                {row.athleteIsMember === null ? (
                  <span className="text-neutral-500">—</span>
                ) : (
                  <span className={row.athleteIsMember ? "text-emerald-400" : "text-amber-400"}>
                    {row.athleteIsMember ? "Abonné" : "Non abonné"}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">{row.dateLabel}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.time}</td>
              <td className="px-4 py-2 text-right">
                {/* Private classes are always logged as already delivered — reuse the
                    louder "reported" warning since deleting erases recorded hours. */}
                <DeleteClassButton id={row.id} reported />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                Aucun cours privé sur cette période.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
