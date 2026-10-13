import Code from '@react-spectrum/s2/icons/Code';
import FileText from '@react-spectrum/s2/icons/FileText';
import ImageIcon from '@react-spectrum/s2/icons/Image';
import Video from '@react-spectrum/s2/icons/Video';
import { HOME_COPY, SKILL_COPY } from '../../copy.ts';
import type { HomeMaterial } from '../../model/home-brief.ts';
import type { HomeTemplate } from '../../model/home-templates.ts';
import { ComposerToken, composerTokenList } from '../composer-token.tsx';
import { TemplateCover } from './template-cover.tsx';

const KIND_ICON = { media: Video, image: ImageIcon, document: FileText } as const;

/**
 * Above the input box text (prototype new-agent.jsx `AgentHero` attachments): the picked skills, the chosen template, and the local materials to hand to the Agent.
 * Materials list only their names; hovering shows the full path, and the path is written into the message when sent. The marker look is in composer-token.tsx, the same as the skill markers in the session input box.
 */
export function BriefTokens({
  skills,
  template,
  materials,
  onRemoveSkill,
  onRemoveTemplate,
  onRemoveMaterial,
}: {
  /** Picked skills, in the order attached; empty when none is chosen. */
  skills: readonly { id: string; name: string }[];
  template: HomeTemplate | null;
  materials: readonly HomeMaterial[];
  onRemoveSkill(id: string): void;
  onRemoveTemplate(): void;
  onRemoveMaterial(path: string): void;
}) {
  if (!skills.length && !template && !materials.length) return null;
  return (
    <div className={composerTokenList}>
      {skills.map((skill) => (
        <ComposerToken
          key={skill.id}
          icon={<Code />}
          label={SKILL_COPY.token(skill.name)}
          removeLabel={SKILL_COPY.remove(skill.name)}
          onRemove={() => onRemoveSkill(skill.id)}
        />
      ))}
      {template ? (
        // The template chosen above the input box (prototype `.home-template-token`): small cover, name, remove.
        <ComposerToken
          icon={<TemplateCover template={template} size="xs" />}
          label={HOME_COPY.templateToken(template.title)}
          removeLabel={HOME_COPY.removeTemplate}
          onRemove={onRemoveTemplate}
        />
      ) : null}
      {materials.map((material) => {
        const Icon = KIND_ICON[material.kind];
        return (
          <ComposerToken
            key={material.path}
            icon={<Icon />}
            label={material.name}
            title={material.path}
            removeLabel={HOME_COPY.removeMaterial(material.name)}
            onRemove={() => onRemoveMaterial(material.path)}
          />
        );
      })}
    </div>
  );
}
