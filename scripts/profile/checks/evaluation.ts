import { siteSourceId } from '../../../src/core/knowledge/product-sites';
import type { ProfileData } from '../../../src/profile/schema';
import { DOCUMENTS } from '../bundle/layout';
import { pointer, type BundleProblem } from '../bundle/problems';

/**
 * The evaluation can grade what it states: each case has its own id, every
 * source a case expects cited is one the record can cite, and every action a
 * calibration answer is judged against is one the assistant has.
 */

function duplicateIdProblems(data: ProfileData): BundleProblem[] {
  const seen = new Set<string>();
  return data.evaluation.cases.flatMap(({ id }, index) => {
    const duplicate = seen.has(id);
    seen.add(id);
    return duplicate
      ? [
          {
            document: DOCUMENTS.cases,
            at: pointer([index, 'id']),
            problem: `"${id}" is the id of an earlier case`,
            remedy: 'give each case its own id',
          },
        ]
      : [];
  });
}

function citationProblems(data: ProfileData): BundleProblem[] {
  const { sourceLabels, productSites } = data.knowledge;
  const citable = new Set([
    ...Object.keys(sourceLabels),
    ...productSites.map(({ url }) => siteSourceId(url)),
  ]);
  return data.evaluation.cases.flatMap(({ expect }, index) =>
    (expect.cites ?? []).flatMap((id, position) =>
      citable.has(id)
        ? []
        : [
            {
              document: DOCUMENTS.cases,
              at: pointer([index, 'expect', 'cites', position]),
              problem: `"${id}" is not a source of the record`,
              remedy: 'cite a source id of knowledge/sources.yaml, or site:<url> of a site passage',
            },
          ],
    ),
  );
}

function actionProblems(data: ProfileData, toolNames: ReadonlySet<string>): BundleProblem[] {
  return data.evaluation.calibration.flatMap(({ actions = [] }, index) =>
    actions.flatMap(({ name }, position) =>
      toolNames.has(name)
        ? []
        : [
            {
              document: DOCUMENTS.calibration,
              at: pointer([index, 'actions', position, 'name']),
              problem: `"${name}" is not an action of the assistant`,
              remedy: "name one of the assistant's actions",
            },
          ],
    ),
  );
}

/**
 * `toolNames` are the assistant's actions, when known. They come from the
 * tool registry, which needs the compiled copy's labels to be built; until a
 * profile's copy is compiled the calibration's action names are not checked.
 */
export function checkEvaluation(
  data: ProfileData,
  toolNames?: ReadonlySet<string>,
): BundleProblem[] {
  return [
    ...duplicateIdProblems(data),
    ...citationProblems(data),
    ...(toolNames ? actionProblems(data, toolNames) : []),
  ];
}
