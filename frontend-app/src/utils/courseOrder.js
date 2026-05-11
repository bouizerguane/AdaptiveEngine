const orderValue = (item) => item?.orderIndex ?? item?.ordre ?? item?.position ?? 0;

export const sortByPlanOrder = (items = []) => [...items].sort((a, b) => orderValue(a) - orderValue(b));

export const normalizeCourseTree = (course) => {
    if (!course) return null;
    return {
        ...course,
        modules: sortByPlanOrder(course.modules || []).map(module => ({
            ...module,
            chapitres: sortByPlanOrder(module.chapitres || []).map(chapitre => ({
                ...chapitre,
                concepts: sortByPlanOrder(chapitre.concepts || []),
            })),
        })),
    };
};

export const flattenConcepts = (courseOrModules) => {
    const modules = Array.isArray(courseOrModules) ? courseOrModules : (courseOrModules?.modules || []);
    return (modules || []).flatMap(module =>
        (module.chapitres || []).flatMap(chapitre =>
            (chapitre.concepts || []).map(concept => ({
                ...concept,
                moduleTitle: module.title,
                chapitreTitle: chapitre.title,
            }))
        )
    );
};
