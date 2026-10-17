'use strict';

/**
 * Sequelize-cli variant (tham chiếu). Project PA3 dùng file SQL: `005_disciplines.sql`.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => String(t).toLowerCase());

    if (!tableNames.includes('disciplines')) {
      await queryInterface.createTable('disciplines', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false,
          unique: true,
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      });
    }

    const defaultDisciplines = [
      { code: 'architecture', name: 'Kiến trúc', description: 'Bộ môn Kiến trúc' },
      { code: 'structure', name: 'Kết cấu', description: 'Bộ môn Kết cấu' },
      { code: 'plumbing', name: 'Cấp thoát nước', description: 'Bộ môn Cấp thoát nước' },
      { code: 'electrical', name: 'Điện', description: 'Bộ môn Điện' },
      { code: 'hvac', name: 'Thông gió - Điều hòa', description: 'Bộ môn HVAC & Thông gió' },
      { code: 'other', name: 'Khác', description: 'Bộ môn Khác' },
    ];

    for (const d of defaultDisciplines) {
      await queryInterface.sequelize.query(`
        INSERT INTO disciplines (code, name, description, created_at, updated_at)
        SELECT :code, :name, :description, NOW(), NOW()
        FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM disciplines WHERE code = :code)
      `, { replacements: d });
    }

    const bimColumns = await queryInterface.describeTable('bim_models');

    if (!bimColumns.discipline_id) {
      await queryInterface.addColumn('bim_models', 'discipline_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'name',
      });
    }

    if (bimColumns.discipline) {
      await queryInterface.sequelize.query(`
        UPDATE bim_models b
        LEFT JOIN disciplines d ON d.code = (
          CASE LOWER(TRIM(b.discipline))
            WHEN 'architectural' THEN 'architecture'
            WHEN 'structural' THEN 'structure'
            WHEN 'mep' THEN 'hvac'
            WHEN 'water' THEN 'plumbing'
            WHEN 'electric' THEN 'electrical'
            ELSE LOWER(TRIM(b.discipline))
          END
        )
        SET b.discipline_id = COALESCE(d.id, (SELECT id FROM disciplines WHERE code = 'other' LIMIT 1))
        WHERE b.discipline_id IS NULL
      `);

      await queryInterface.removeColumn('bim_models', 'discipline');
    }

    await queryInterface.sequelize.query(`
      UPDATE bim_models
      SET discipline_id = (SELECT id FROM disciplines WHERE code = 'other' LIMIT 1)
      WHERE discipline_id IS NULL
    `);

    await queryInterface.changeColumn('bim_models', 'discipline_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    const indexes = await queryInterface.showIndex('bim_models');
    if (!indexes.some((i) => i.name === 'idx_bim_models_discipline')) {
      await queryInterface.addIndex('bim_models', ['discipline_id'], {
        name: 'idx_bim_models_discipline',
      });
    }

    try {
      await queryInterface.addConstraint('bim_models', {
        fields: ['discipline_id'],
        type: 'foreign key',
        name: 'fk_bim_models_discipline',
        references: { table: 'disciplines', field: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });
    } catch {
      /* already exists */
    }
  },

  async down(queryInterface, Sequelize) {
    const bimColumns = await queryInterface.describeTable('bim_models');

    if (bimColumns.discipline_id) {
      await queryInterface.removeConstraint('bim_models', 'fk_bim_models_discipline').catch(() => {});
      await queryInterface.removeIndex('bim_models', 'idx_bim_models_discipline').catch(() => {});

      if (!bimColumns.discipline) {
        await queryInterface.addColumn('bim_models', 'discipline', {
          type: Sequelize.STRING(255),
          allowNull: true,
        });

        await queryInterface.sequelize.query(`
          UPDATE bim_models b
          LEFT JOIN disciplines d ON d.id = b.discipline_id
          SET b.discipline = COALESCE(d.code, 'other')
        `);

        await queryInterface.changeColumn('bim_models', 'discipline', {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: 'other',
        });
      }

      await queryInterface.removeColumn('bim_models', 'discipline_id');
    }

    const tables = await queryInterface.showAllTables();
    if (tables.map((t) => String(t).toLowerCase()).includes('disciplines')) {
      await queryInterface.dropTable('disciplines');
    }
  },
};
